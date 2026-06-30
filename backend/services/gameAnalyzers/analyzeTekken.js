const sharp = require('sharp');

async function analyzeTekken(framePaths, frameResults) {
  if (!framePaths || framePaths.length === 0 || !frameResults || frameResults.length === 0) {
    return null;
  }

  const numFrames = Math.min(framePaths.length, frameResults.length);
  const perFrame = [];

  for (let i = 0; i < numFrames; i++) {
    const analysis = await analyzeTekkenFrame(framePaths[i], frameResults[i]);
    perFrame.push(analysis);
  }

  // Combo execution: detect opponent health chunks = big damage in single combo
  let comboScore = 30;
  const healthChunks = [];
  for (let i = 1; i < perFrame.length; i++) {
    const prev = perFrame[i - 1].opponentHealth;
    const curr = perFrame[i].opponentHealth;
    if (prev != null && curr != null && prev > 0) {
      const drop = prev - curr;
      if (drop > 15) healthChunks.push(drop);
    }
  }
  if (healthChunks.length > 0) {
    const avgChunk = healthChunks.reduce((a, b) => a + b, 0) / healthChunks.length;
    comboScore = Math.round(Math.min(100, avgChunk * 3 + healthChunks.length * 10));
  }

  // Defense: own health bar stability
  let defenseScore = 70;
  let ownHealthDrops = 0;
  for (let i = 1; i < perFrame.length; i++) {
    const prev = perFrame[i - 1].ownHealth;
    const curr = perFrame[i].ownHealth;
    if (prev != null && curr != null && curr < prev) {
      ownHealthDrops += prev - curr;
    }
  }
  if (ownHealthDrops > 50) {
    defenseScore = Math.round(Math.max(15, 70 - ownHealthDrops * 0.5));
  }

  // Damage output: opponent total health depletion
  let damageOutput = 30;
  const firstOppHealth = perFrame.find(f => f.opponentHealth != null);
  const lastOppHealth = perFrame.slice().reverse().find(f => f.opponentHealth != null);
  if (firstOppHealth && lastOppHealth && firstOppHealth.opponentHealth > 0) {
    const depletion = firstOppHealth.opponentHealth - lastOppHealth.opponentHealth;
    damageOutput = Math.round(Math.min(100, (depletion / 100) * 100));
  }

  // Pacing: round transitions + hit spark frequency
  const roundTransitions = perFrame.filter(f => f.roundTransition).length;
  const hitSparkFrames = perFrame.filter(f => f.hitSpark).length;
  const pacingScore = Math.round(Math.min(100,
    (roundTransitions * 25) + (hitSparkFrames / numFrames) * 60 + 20
  ));

  const skillScore = Math.round(
    comboScore * 0.35 +
    defenseScore * 0.25 +
    damageOutput * 0.25 +
    pacingScore * 0.15
  );

  const animationRatio = numFrames > 0
    ? perFrame.filter(f => f.hudOrAnimation).length / numFrames
    : 0;
  const confidence = Math.min(1, animationRatio * 0.5 + (numFrames / 6) * 0.4);

  return {
    skillScore: Math.max(10, Math.min(99, skillScore)),
    metrics: { comboExecution: comboScore, defense: defenseScore, damageOutput, matchPacing: pacingScore },
    confidence: Math.round(confidence * 100) / 100,
    source: 'cv',
  };
}

async function analyzeTekkenFrame(framePath, frameResult) {
  const result = {
    ownHealth: null,
    opponentHealth: null,
    roundTransition: false,
    hitSpark: false,
    hudOrAnimation: frameResult.hudBarsDetected || frameResult.isAnimation || false,
  };

  const { data, info } = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Health bars: top 8% of screen
  const hbTop = 0;
  const hbH = Math.floor(height * 0.08);
  const hbMidX = Math.floor(width / 2);

  // P1 health: left side (left 40% of top bar)
  const p1BarW = Math.floor(width * 0.35);
  let p1Green = 0, p1Red = 0, p1Total = 0;
  for (let y = hbTop; y < Math.min(hbTop + hbH, height); y += 2) {
    for (let x = 2; x < p1BarW; x += 4) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (g > 100 && r < g * 0.5 && b < g * 0.5) p1Green++;
      if (r > 120 && g < r * 0.5 && b < r * 0.5) p1Red++;
      p1Total++;
    }
  }

  // P2 health: right side
  const p2BarX = Math.floor(width * 0.65);
  const p2BarW = Math.floor(width * 0.35);
  let p2Green = 0, p2Red = 0, p2Total = 0;
  for (let y = hbTop; y < Math.min(hbTop + hbH, height); y += 2) {
    for (let x = p2BarX; x < Math.min(p2BarX + p2BarW, width); x += 4) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (g > 100 && r < g * 0.5 && b < g * 0.5) p2Green++;
      if (r > 120 && g < r * 0.5 && b < r * 0.5) p2Red++;
      p2Total++;
    }
  }

  const estimateHealth = (green, red, total) => {
    if (total === 0) return null;
    const barRatio = (green + red) / total;
    if (barRatio < 0.01) return null; // no health bar detected
    const greenRatio = green / (green + red || 1);
    return Math.round(greenRatio * 100);
  };

  result.ownHealth = estimateHealth(p1Green, p1Red, p1Total);
  result.opponentHealth = estimateHealth(p2Green, p2Red, p2Total);

  // Round transition: detect "K.O." or round number text overlay in center
  const koY = Math.floor(height * 0.35);
  const koH = Math.floor(height * 0.30);
  let whiteTextPx = 0, totalKo = 0;
  for (let y = koY; y < Math.min(koY + koH, height); y += 4) {
    for (let x = Math.floor(width * 0.25); x < Math.floor(width * 0.75); x += 4) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (bright > 0.80 && r > 180 && g > 180 && b > 180) whiteTextPx++;
      totalKo++;
    }
  }
  result.roundTransition = totalKo > 0 && (whiteTextPx / totalKo) > 0.15;

  // Hit spark: bright flash in center combat area
  const sY = Math.floor(height * 0.20);
  const sH = Math.floor(height * 0.60);
  const sX = Math.floor(width * 0.15);
  const sW = Math.floor(width * 0.70);
  let sparkPx = 0, totalSpark = 0;
  for (let y = sY; y < Math.min(sY + sH, height); y += 4) {
    for (let x = sX; x < Math.min(sX + sW, width); x += 4) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (bright > 0.90 && (r > 200 || g > 200 || b > 200)) sparkPx++;
      totalSpark++;
    }
  }
  result.hitSpark = totalSpark > 0 && (sparkPx / totalSpark) > 0.10;

  return result;
}

module.exports = analyzeTekken;
