const sharp = require('sharp');

async function analyzeValorant(framePaths, frameResults, yoloData) {
  if (!framePaths || framePaths.length === 0 || !frameResults || frameResults.length === 0) {
    return null;
  }

  const numFrames = Math.min(framePaths.length, frameResults.length);
  const perFrame = [];

  for (let i = 0; i < numFrames; i++) {
    const analysis = await analyzeValorantFrame(framePaths[i], frameResults[i]);
    perFrame.push(analysis);
  }

  const crosshairFrames = perFrame.filter(f => f.crosshairDetected).length;
  const crosshairRatio = numFrames > 0 ? crosshairFrames / numFrames : 0;

  let crosshairSmoothness = 30;
  const positions = perFrame.filter(f => f.crosshairX != null);
  if (positions.length >= 2) {
    let totalVelocity = 0;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x;
      const dy = positions[i].y - positions[i - 1].y;
      totalVelocity += Math.sqrt(dx * dx + dy * dy);
    }
    const avgVel = totalVelocity / (positions.length - 1);
    crosshairSmoothness = Math.round(Math.max(0, Math.min(100, 100 - avgVel * 2)));
  }

  let killActivity = numFrames > 0
    ? Math.round((perFrame.filter(f => f.killDetected).length / numFrames) * 100)
    : 0;

  const placementScore = crosshairFrames > 0
    ? Math.round((perFrame.filter(f => f.crosshairCentered).length / crosshairFrames) * 100)
    : 50;

  let abilityUsage = numFrames > 0
    ? Math.round((perFrame.filter(f => f.abilityDetected).length / numFrames) * 100)
    : 0;

  const minimapFrames = perFrame.filter(f => f.minimapDetected).length;
  let gameKnowledge = numFrames > 0
    ? Math.round((minimapFrames / numFrames) * 100)
    : 0;

  // Phase 2: YOLO enhancement
  let yoloSource = false;
  if (yoloData && typeof yoloData === 'object' && !yoloData.error) {
    let totalEnemies = 0;
    let totalTeammates = 0;
    let totalSpikes = 0;
    let yoloFrames = 0;

    for (const [framePath, detections] of Object.entries(yoloData)) {
      if (!Array.isArray(detections)) continue;
      yoloFrames++;
      for (const d of detections) {
        if (d.class === 'enemy') totalEnemies++;
        if (d.class === 'teammate') totalTeammates++;
        if (d.class === 'planted spike' || d.class === 'dropped spike') totalSpikes++;
      }
    }

    if (yoloFrames > 0) {
      yoloSource = true;
      const enemyRatio = totalEnemies / yoloFrames;
      const spikeRatio = totalSpikes / yoloFrames;

      if (enemyRatio > 0) {
        killActivity = Math.min(100, killActivity + Math.round(enemyRatio * 20));
      }
      if (spikeRatio > 0) {
        gameKnowledge = Math.min(100, gameKnowledge + Math.round(spikeRatio * 25));
      }
      if (totalTeammates > 0) {
        gameKnowledge = Math.min(100, gameKnowledge + 10);
      }
    }
  }

  const skillScore = Math.round(
    crosshairSmoothness * 0.30 +
    killActivity * 0.25 +
    placementScore * 0.20 +
    abilityUsage * 0.15 +
    gameKnowledge * 0.10
  );

  let confidence = Math.min(1, crosshairRatio * 0.5 + (numFrames / 6) * 0.5);
  if (yoloSource) confidence = Math.min(1, confidence + 0.15);

  return {
    skillScore: Math.max(10, Math.min(99, skillScore)),
    metrics: { crosshairSmoothness, killActivity, crosshairPlacement: placementScore, abilityUsage, gameKnowledge },
    confidence: Math.round(confidence * 100) / 100,
    source: yoloSource ? 'yolo' : 'cv',
  };
}

async function analyzeValorantFrame(framePath, frameResult) {
  const result = {
    crosshairDetected: frameResult.crosshairDetected || false,
    crosshairX: null,
    crosshairY: null,
    crosshairCentered: false,
    killDetected: false,
    abilityDetected: false,
    minimapDetected: frameResult.minimapDetected || false,
  };

  if (!result.crosshairDetected) return result;

  const { data, info } = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const R = 20;

  let bestX = cx, bestY = cy, bestH = 0, bestV = 0;

  for (let x = cx - R; x <= cx + R; x++) {
    if (x < 1 || x >= width - 1) continue;
    const idx = (cy * width + x) * channels;
    const b = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    const lx = Math.max(0, x - 2);
    const rx = Math.min(width - 1, x + 2);
    const lb = ((data[(cy * width + lx) * channels]) * 0.299 + data[(cy * width + lx) * channels + 1] * 0.587 + data[(cy * width + lx) * channels + 2] * 0.114) / 255;
    const rb = ((data[(cy * width + rx) * channels]) * 0.299 + data[(cy * width + rx) * channels + 1] * 0.587 + data[(cy * width + rx) * channels + 2] * 0.114) / 255;
    const c = Math.abs(b - lb) + Math.abs(b - rb);
    if (c > bestH) { bestH = c; bestX = x; }
  }

  for (let y = cy - R; y <= cy + R; y++) {
    if (y < 1 || y >= height - 1) continue;
    const idx = (y * width + cx) * channels;
    const b = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    const ty = Math.max(0, y - 2);
    const by = Math.min(height - 1, y + 2);
    const tb = ((data[(ty * width + cx) * channels]) * 0.299 + data[(ty * width + cx) * channels + 1] * 0.587 + data[(ty * width + cx) * channels + 2] * 0.114) / 255;
    const bb = ((data[(by * width + cx) * channels]) * 0.299 + data[(by * width + cx) * channels + 1] * 0.587 + data[(by * width + cx) * channels + 2] * 0.114) / 255;
    const c = Math.abs(b - tb) + Math.abs(b - bb);
    if (c > bestV) { bestV = c; bestY = y; }
  }

  result.crosshairX = bestX;
  result.crosshairY = bestY;
  result.crosshairCentered = bestY >= height * 0.35 && bestY <= height * 0.65;

  const krX = Math.floor(width * 0.82);
  const krY = 0;
  const krW = Math.floor(width * 0.18);
  const krH = Math.floor(height * 0.18);
  let redPx = 0, totalKr = 0;
  for (let y = krY; y < Math.min(krY + krH, height); y += 3) {
    for (let x = krX; x < Math.min(krX + krW, width); x += 3) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 160 && g < 80 && b < 80) redPx++;
      totalKr++;
    }
  }
  result.killDetected = totalKr > 0 && (redPx / totalKr) > 0.008;

  const abX = 0;
  const abY = Math.floor(height * 0.80);
  const abW = Math.floor(width * 0.12);
  const abH = Math.floor(height * 0.20);
  let transitions = 0, totalAb = 0, prevR = -1, prevG = -1, prevB = -1;
  for (let y = abY; y < Math.min(abY + abH, height); y += 4) {
    for (let x = abX; x < Math.min(abX + abW, width); x += 4) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (prevR >= 0) {
        const d = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
        if (d > 80 && bright > 0.08 && bright < 0.92) transitions++;
      }
      prevR = r; prevG = g; prevB = b;
      totalAb++;
    }
  }
  result.abilityDetected = totalAb > 0 && (transitions / totalAb) > 0.015;

  return result;
}

module.exports = analyzeValorant;
