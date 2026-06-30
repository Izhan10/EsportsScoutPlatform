function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val || 0));
}

function computeAuthenticity(frameAnalysis, mlConfidence) {
  if (!frameAnalysis) return 50;

  let score = 0;
  let factors = 0;

  // ML confidence (most reliable signal)
  if (mlConfidence != null) {
    score += mlConfidence * 100;
    factors++;
  }

  // Crosshair detected across frames = strong gameplay signal
  if (frameAnalysis.crosshairDetected) {
    score += 95;
    factors++;
  }

  // HUD bars = strong gameplay signal
  if (frameAnalysis.hudBarsDetected) {
    score += 85;
    factors++;
  }

  // Minimap = moderate gameplay signal
  if (frameAnalysis.minimapDetected) {
    score += 70;
    factors++;
  }

  // Text density (in-game UI text)
  if (frameAnalysis.textDenseDetected) {
    score += 50;
    factors++;
  }

  // Natural scene without UI = likely not gameplay
  if (frameAnalysis.isNaturalScene && !frameAnalysis.crosshairDetected && !frameAnalysis.hudBarsDetected) {
    score -= 40;
    factors++;
  }

  // Screen recording without game UI
  if (frameAnalysis.screenRecordingDetected && !frameAnalysis.crosshairDetected && !frameAnalysis.hudBarsDetected) {
    score -= 30;
    factors++;
  }

  return clamp(Math.round(score / Math.max(factors, 1)), 10, 99);
}

function computeActionIntensity(frameAnalysis) {
  if (!frameAnalysis) return 50;

  let score = 0;
  let factors = 0;

  // Inter-frame variation: high = active scene changes = gameplay action
  const cv = frameAnalysis.interFrameCV || 0;
  if (frameAnalysis.isStaticContent) {
    score += 10;
  } else if (cv < 0.02) {
    score += 30;
  } else if (cv < 0.05) {
    score += 55;
  } else if (cv < 0.10) {
    score += 75;
  } else {
    score += 90;
  }
  factors++;

  // Edge density variation across frames
  const edgeCv = frameAnalysis.interFrameEdgeCV || 0;
  if (edgeCv < 0.05) {
    score += 25;
  } else if (edgeCv < 0.10) {
    score += 50;
  } else if (edgeCv < 0.20) {
    score += 70;
  } else {
    score += 85;
  }
  factors++;

  // HUD edge score suggests active game UI
  const hudEdge = frameAnalysis.avgHudEdge || 0;
  if (hudEdge > 0.15) score += 80;
  else if (hudEdge > 0.08) score += 60;
  else if (hudEdge > 0.03) score += 40;
  else score += 20;
  factors++;

  return clamp(Math.round(score / factors), 10, 99);
}

function computeVisualClarity(frameAnalysis, videoMeta) {
  if (!frameAnalysis) return 50;

  let score = 0;
  let factors = 0;

  // Edge density = visual detail level
  const edgeDensity = frameAnalysis.avgEdgeDensity || 0;
  if (edgeDensity > 0.15) score += 85;
  else if (edgeDensity > 0.08) score += 70;
  else if (edgeDensity > 0.04) score += 55;
  else score += 35;
  factors++;

  // Contrast = image clarity
  const contrast = frameAnalysis.avgContrast || 0;
  if (contrast > 0.25) score += 85;
  else if (contrast > 0.18) score += 70;
  else if (contrast > 0.12) score += 55;
  else score += 35;
  factors++;

  // Color diversity = visual richness
  const colorDiv = frameAnalysis.avgColorDiversity || 0;
  if (colorDiv > 60) score += 80;
  else if (colorDiv > 30) score += 65;
  else if (colorDiv > 15) score += 50;
  else score += 30;
  factors++;

  // Brightness: properly exposed footage
  const brightness = frameAnalysis.avgBrightness || 0;
  if (brightness > 0.25 && brightness < 0.65) score += 75;
  else score += 40;
  factors++;

  return clamp(Math.round(score / factors), 10, 99);
}

function computeCrosshairActivity(frameAnalysis) {
  if (!frameAnalysis) return 50;

  let score = 0;
  let factors = 0;

  // Crosshair consistently detected = player is actively aiming
  if (frameAnalysis.crosshairDetected) {
    score += 90;
    factors++;
  }

  // Corner edge activity suggests active gameplay
  const hudEdge = frameAnalysis.avgHudEdge || 0;
  if (hudEdge > 0.12) score += 80;
  else if (hudEdge > 0.06) score += 55;
  else score += 25;
  factors++;

  // Text clusters suggest in-game information being processed
  const textClusters = frameAnalysis.avgTextClusters || 0;
  if (textClusters > 20) score += 70;
  else if (textClusters > 10) score += 55;
  else if (textClusters > 5) score += 40;
  else score += 25;
  factors++;

  // If crosshair not detected, this is likely not an aim-intensive game
  // Tekken 8 doesn't have crosshairs, so adjust based on game context
  if (!frameAnalysis.crosshairDetected && frameAnalysis.hudBarsDetected && frameAnalysis.isAnimation) {
    // Fighting game pattern: no crosshair but has HUD and cartoon style
    score += 65;
    factors++;
  }

  return factors > 0 ? clamp(Math.round(score / factors), 5, 99) : 30;
}

function computeProductionQuality(videoMeta) {
  if (!videoMeta || !videoMeta.width) return 50;

  let score = 0;
  let factors = 0;

  const pixels = (videoMeta.width || 0) * (videoMeta.height || 0);
  if (pixels >= 1920 * 1080) score += 85;
  else if (pixels >= 1280 * 720) score += 70;
  else if (pixels >= 854 * 480) score += 50;
  else score += 30;
  factors++;

  const fps = videoMeta.fps || 0;
  if (fps >= 60) score += 85;
  else if (fps >= 30) score += 65;
  else if (fps >= 24) score += 50;
  else score += 30;
  factors++;

  if (videoMeta.hasAudio) {
    score += 70;
    factors++;
  }

  return clamp(Math.round(score / factors), 10, 99);
}

function generateSummary(esv, authScore, actionScore, crosshairScore, gameTitle) {
  const game = gameTitle || 'the game';

  if (esv >= 80) {
    const highlights = [];
    if (authScore >= 80) highlights.push('Authentic gameplay footage with clear game UI');
    if (actionScore >= 75) highlights.push('high action intensity');
    if (crosshairScore >= 70) highlights.push('active crosshair engagement');
    return `High-quality ${game} clip. ${highlights.join(', ')}.`;
  }

  if (esv >= 60) {
    return `${game} gameplay clip with ${authScore >= 60 ? 'visible game UI' : 'some game elements'} and ${actionScore >= 60 ? 'moderate action' : 'limited action'}.`;
  }

  return `Clip contains ${authScore >= 50 ? 'some gameplay elements' : 'limited gameplay indicators'} in ${game}. Further review recommended.`;
}

function generateRecs(authScore, actionScore, crosshairScore, gameTitle) {
  const recs = [];
  if (authScore < 60) {
    recs.push('Upload clips with visible game UI (crosshair, HUD, minimap) for stronger analysis');
  }
  if (actionScore < 55) {
    recs.push('Choose clips with more active gameplay moments rather than menu/static scenes');
  }
  if (crosshairScore < 50) {
    recs.push('Ensure crosshair/reticle is visible for better aim evaluation');
  }
  if (authScore >= 70 && actionScore >= 60) {
    recs.push('Continue uploading gameplay to build your ESV profile');
  }
  if (recs.length === 0) {
    recs.push('Upload more clips for richer AI feedback');
  }
  return recs;
}

async function analyzeClip({ gameTitle, videoMeta, frameAnalysis, mlConfidence } = {}) {
  const authScore = computeAuthenticity(frameAnalysis, mlConfidence);
  const actionScore = computeActionIntensity(frameAnalysis);
  const clarityScore = computeVisualClarity(frameAnalysis, videoMeta);
  const crosshairScore = computeCrosshairActivity(frameAnalysis);
  const productionScore = computeProductionQuality(videoMeta);

  const esv = Math.round(
    authScore * 0.40 +
    actionScore * 0.25 +
    clarityScore * 0.15 +
    crosshairScore * 0.10 +
    productionScore * 0.10
  );

  const summary = generateSummary(esv, authScore, actionScore, crosshairScore, gameTitle);
  const recommendations = generateRecs(authScore, actionScore, crosshairScore, gameTitle);

  return {
    esv: clamp(esv, 0, 99),
    aim: clamp(authScore, 0, 99),
    positioning: clamp(actionScore, 0, 99),
    teamplay: clamp(clarityScore, 0, 99),
    consistency: clamp(crosshairScore, 0, 99),
    decisionMaking: clamp(productionScore, 0, 99),
    summary,
    recommendations,
  };
}

module.exports = { analyzeClip };
