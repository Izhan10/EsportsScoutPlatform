const sharp = require('sharp');

async function analyzePUBG(framePaths, frameResults) {
  if (!framePaths || framePaths.length === 0 || !frameResults || frameResults.length === 0) {
    return null;
  }

  const numFrames = Math.min(framePaths.length, frameResults.length);
  const perFrame = [];

  for (let i = 0; i < numFrames; i++) {
    const analysis = await analyzePUBGFrame(framePaths[i], frameResults[i]);
    perFrame.push(analysis);
  }

  const combatFrames = perFrame.filter(f => f.combatDetected).length;
  const combatActivity = numFrames > 0
    ? Math.round((combatFrames / numFrames) * 100)
    : 0;

  const minimapFrames = perFrame.filter(f => f.minimapDetected).length;
  const healthReadable = perFrame.filter(f => f.healthReadable).length;
  const survivalAwareness = numFrames > 0
    ? Math.round(((minimapFrames * 0.6 + healthReadable * 0.4) / numFrames) * 100)
    : 0;

  const weaponFrames = perFrame.filter(f => f.weaponDetected).length;
  const ammoFrames = perFrame.filter(f => f.ammoDetected).length;
  const weaponHandling = numFrames > 0
    ? Math.round(((weaponFrames * 0.6 + ammoFrames * 0.4) / numFrames) * 100)
    : 0;

  let movementQuality = 50;
  const brightnesses = frameResults.map(f => f.avgBrightness).filter(b => b != null);
  if (brightnesses.length >= 2) {
    const meanB = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const varB = brightnesses.reduce((s, b) => s + (b - meanB) ** 2, 0) / brightnesses.length;
    const cv = Math.sqrt(varB) / (meanB || 0.001);
    movementQuality = cv < 0.02 ? 80 : cv < 0.05 ? 65 : cv < 0.12 ? 50 : 35;
  }

  const skillScore = Math.round(
    combatActivity * 0.35 +
    survivalAwareness * 0.25 +
    weaponHandling * 0.20 +
    movementQuality * 0.20
  );

  const hudRatio = numFrames > 0
    ? perFrame.filter(f => f.hudDetected).length / numFrames
    : 0;
  const confidence = Math.min(1, hudRatio * 0.5 + (numFrames / 6) * 0.4);

  return {
    skillScore: Math.max(10, Math.min(99, skillScore)),
    metrics: { combatActivity, survivalAwareness, weaponHandling, movementQuality },
    confidence: Math.round(confidence * 100) / 100,
    source: 'cv',
  };
}

async function analyzePUBGFrame(framePath, frameResult) {
  const result = {
    combatDetected: false,
    healthReadable: false,
    weaponDetected: false,
    ammoDetected: false,
    minimapDetected: frameResult.minimapDetected || false,
    hudDetected: frameResult.hudBarsDetected || false,
  };

  const { data, info } = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Damage indicators: red vignette on edges
  let edgeRedPx = 0, totalEdge = 0;
  const edgeStrip = Math.floor(height * 0.08);
  // Check top and bottom edges for red tint
  for (let y = 0; y < edgeStrip; y += 3) {
    for (let x = 0; x < width; x += 6) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > g + 30 && r > b + 30) edgeRedPx++;
      totalEdge++;
    }
  }
  for (let y = height - edgeStrip; y < height; y += 3) {
    for (let x = 0; x < width; x += 6) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > g + 30 && r > b + 30) edgeRedPx++;
      totalEdge++;
    }
  }
  const edgeRedRatio = totalEdge > 0 ? edgeRedPx / totalEdge : 0;

  // Muzzle flash: sudden bright center area
  const flashR = Math.floor(width * 0.15);
  const flashRegion = height * 0.20;
  let brightPx = 0, totalFlash = 0;
  for (let y = Math.floor(height * 0.30); y < Math.floor(height * 0.70); y += 3) {
    for (let x = Math.floor(width * 0.35); x < Math.floor(width * 0.65); x += 3) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if (bright > 0.85) brightPx++;
      totalFlash++;
    }
  }
  const flashRatio = totalFlash > 0 ? brightPx / totalFlash : 0;

  result.combatDetected = edgeRedRatio > 0.03 || flashRatio > 0.15;

  // Health bar: bottom-center green/red bar
  const hbY = Math.floor(height * 0.88);
  const hbH = Math.floor(height * 0.08);
  const hbX = Math.floor(width * 0.30);
  const hbW = Math.floor(width * 0.40);
  let healthGreenPx = 0, healthRedPx = 0, totalHb = 0;
  for (let y = hbY; y < Math.min(hbY + hbH, height); y += 2) {
    for (let x = hbX; x < Math.min(hbX + hbW, width); x += 2) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (g > 100 && r < g * 0.6 && b < g * 0.6) healthGreenPx++;
      if (r > 120 && g < r * 0.5 && b < r * 0.5) healthRedPx++;
      totalHb++;
    }
  }
  const healthRatio = totalHb > 0 ? (healthGreenPx + healthRedPx) / totalHb : 0;
  result.healthReadable = healthRatio > 0.02;

  // Weapon icon: bottom-right area
  const wX = Math.floor(width * 0.75);
  const wY = Math.floor(height * 0.85);
  const wW = Math.floor(width * 0.20);
  const wH = Math.floor(height * 0.12);
  let highContrastPx = 0, totalW = 0;
  for (let y = wY; y < Math.min(wY + wH, height); y += 2) {
    for (let x = wX; x < Math.min(wX + wW, width); x += 2) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      if ((bright > 0.7 || bright < 0.15) && (r > 180 || g > 180 || b > 180)) highContrastPx++;
      totalW++;
    }
  }
  result.weaponDetected = totalW > 0 && (highContrastPx / totalW) > 0.05;

  // Ammo count: bottom-right, small white text area
  const aX = Math.floor(width * 0.75);
  const aY = Math.floor(height * 0.92);
  const aW = Math.floor(width * 0.15);
  const aH = Math.floor(height * 0.08);
  let whitePx = 0, totalA = 0;
  for (let y = aY; y < Math.min(aY + aH, height); y += 2) {
    for (let x = aX; x < Math.min(aX + aW, width); x += 2) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r > 180 && g > 180 && b > 180) whitePx++;
      totalA++;
    }
  }
  result.ammoDetected = totalA > 0 && (whitePx / totalA) > 0.10;

  if (frameResult.hudBarsDetected) result.hudDetected = true;

  return result;
}

module.exports = analyzePUBG;
