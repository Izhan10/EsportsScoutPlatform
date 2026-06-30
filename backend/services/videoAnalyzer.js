const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const sharp = require('sharp');
const { analyzeGameSkill } = require('./gameAnalyzers');
const { runYOLO } = require('./yoloBridge');

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

const FFMPEG_DIR = 'C:\\Users\\SC\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin';

const FFMPEG = fs.existsSync(path.join(FFMPEG_DIR, 'ffmpeg.exe'))
  ? path.join(FFMPEG_DIR, 'ffmpeg.exe')
  : 'ffmpeg';

const FFPROBE = fs.existsSync(path.join(FFMPEG_DIR, 'ffprobe.exe'))
  ? path.join(FFMPEG_DIR, 'ffprobe.exe')
  : 'ffprobe';

function runCommand(cmd, args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

async function getVideoMetadata(videoPath) {
  const { stdout } = await runCommand(FFPROBE, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    videoPath
  ]);
  return JSON.parse(stdout);
}

async function extractFrames(videoPath, duration, outputDir) {
  const timestamps = duration > 30
    ? [0.05, 0.15, 0.3, 0.5, 0.7, 0.85]
    : [0.1, 0.25, 0.5, 0.75, 0.9];

  const framePaths = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = Math.min(timestamps[i] * duration, Math.max(duration - 0.5, 0));
    const outPath = path.join(outputDir, `frame_${i}.jpg`);
    try {
      await runCommand(FFMPEG, [
        '-ss', String(t),
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '2',
        '-vf', 'scale=320:-1',
        '-y',
        outPath
      ], 15000);
      if (fs.existsSync(outPath)) {
        framePaths.push(outPath);
      }
    } catch (_) {}
  }
  return framePaths;
}

function pixelBrightness(r, g, b) {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

function rgbToHue(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta < 0.05) return -1;
  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return ((hue * 60) + 360) % 360;
}

function detectCrosshair(rawPixels, width, height, channels, brightnessValues) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const r = 12; // 25x25 region

  const y0 = Math.max(0, cy - r);
  const y1 = Math.min(height - 1, cy + r);
  const x0 = Math.max(0, cx - r);
  const x1 = Math.min(width - 1, cx + r);

  // Build brightness difference map along vertical and horizontal center lines
  let vLineScore = 0;
  let vLineCount = 0;
  for (let y = y0; y <= y1; y++) {
    const idx = y * width + cx;
    const centerB = brightnessValues[idx];
    if (cx > 0 && cx < width - 1) {
      const leftB = brightnessValues[idx - 1];
      const rightB = brightnessValues[idx + 1];
      const diff = Math.abs(centerB - leftB) + Math.abs(centerB - rightB);
      vLineScore += diff;
      vLineCount++;
    }
  }

  let hLineScore = 0;
  let hLineCount = 0;
  for (let x = x0; x <= x1; x++) {
    const idx = cy * width + x;
    const centerB = brightnessValues[idx];
    if (cy > 0 && cy < height - 1) {
      const topB = brightnessValues[idx - width];
      const bottomB = brightnessValues[idx + width];
      const diff = Math.abs(centerB - topB) + Math.abs(centerB - bottomB);
      hLineScore += diff;
      hLineCount++;
    }
  }

  const avgVLine = vLineCount > 0 ? vLineScore / vLineCount : 0;
  const avgHLine = hLineCount > 0 ? hLineScore / hLineCount : 0;

  // Compare center-line contrast to the rest of the region
  let restScore = 0;
  let restCount = 0;
  for (let y = y0 + 2; y <= y1 - 2; y += 2) {
    for (let x = x0 + 2; x <= x1 - 2; x += 2) {
      if (x === cx || y === cy) continue; // skip center lines
      const idx = y * width + x;
      const b = brightnessValues[idx];
      const leftB = brightnessValues[idx - 1] || b;
      const rightB = brightnessValues[idx + 1] || b;
      const topB = brightnessValues[idx - width] || b;
      const bottomB = brightnessValues[idx + width] || b;
      const diff = Math.abs(b - leftB) + Math.abs(b - rightB) + Math.abs(b - topB) + Math.abs(b - bottomB);
      restScore += diff;
      restCount++;
    }
  }
  const avgRest = restCount > 0 ? restScore / restCount : 0;

  // A crosshair has higher average contrast along the center lines than in the surrounding region
  const crosshairScore = avgRest > 0 ? ((avgVLine + avgHLine) / 2) / avgRest : 0;

  return {
    detected: crosshairScore > 1.3,
  };
}

function detectHUDBars(rawPixels, width, height, channels) {
  // Check top strip (top 6%) and bottom strip (bottom 8%)
  const topHeight = Math.max(8, Math.floor(height * 0.06));
  const bottomHeight = Math.max(12, Math.floor(height * 0.08));
  const minSegmentWidth = Math.floor(width * 0.25);

  let barsFound = 0;

  // Helper: scan a horizontal strip for uniform-color segments
  function scanStrip(yStart, yEnd) {
    for (let y = yStart; y < yEnd; y += 3) {
      let runStart = 0;
      let currentR = -1, currentG = -1, currentB = -1;

      for (let x = 0; x < width; x += 2) {
        const offset = (y * width + x) * channels;
        const r = rawPixels[offset];
        const g = rawPixels[offset + 1];
        const b = rawPixels[offset + 2];
        const brightness = pixelBrightness(r, g, b);

        if (currentR === -1) {
          currentR = r; currentG = g; currentB = b;
          runStart = x;
          continue;
        }

        const colorDiff = Math.abs(r - currentR) + Math.abs(g - currentG) + Math.abs(b - currentB);
        if (colorDiff > 40) {
          const runLen = x - runStart;
          if (runLen >= minSegmentWidth && brightness < 0.85 && brightness > 0.08) {
            // Check that the segment has a neighbor above/below that's different (it's a bar on a background)
            const midX = Math.floor((runStart + x) / 2);
            const midOffset = (y * width + midX) * channels;
            const mR = rawPixels[midOffset], mG = rawPixels[midOffset + 1], mB = rawPixels[midOffset + 2];

            // Check pixel just above the strip
            const aboveY = Math.max(0, y - 3);
            const aboveOffset = (aboveY * width + midX) * channels;
            const aR = rawPixels[aboveOffset], aG = rawPixels[aboveOffset + 1], aB = rawPixels[aboveOffset + 2];
            const aboveDiff = Math.abs(mR - aR) + Math.abs(mG - aG) + Math.abs(mB - aB);

            // Check pixel just below the strip (or inside if at edge)
            const belowY = Math.min(height - 1, y + 6);
            const belowOffset = (belowY * width + midX) * channels;
            const bR = rawPixels[belowOffset], bG = rawPixels[belowOffset + 1], bB = rawPixels[belowOffset + 2];
            const belowDiff = Math.abs(mR - bR) + Math.abs(mG - bG) + Math.abs(mB - bB);

            if (aboveDiff > 40 || belowDiff > 40) {
              barsFound++;
              return; // one bar per strip is enough
            }
          }
          currentR = r; currentG = g; currentB = b;
          runStart = x;
        }
      }
    }
  }

  scanStrip(0, topHeight);
  scanStrip(Math.max(0, height - bottomHeight), height);

  return { hudBarsDetected: barsFound > 0, hudBarCount: barsFound };
}

function detectMinimap(rawPixels, width, height, channels, brightnessValues) {
  // A minimap is a small, bounded rectangular region (usually corner)
  // with a distinct border and detailed internal content
  const cornerSize = Math.min(Math.floor(width * 0.18), Math.floor(height * 0.18));
  if (cornerSize < 20) return { minimapDetected: false };

  function getBrightnessAt(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return brightnessValues[y * width + x];
  }

  function analyzeCorner(startX, startY) {
    // Check for a visible border: edge density along the boundary of this region
    const borderDepth = Math.min(6, Math.floor(cornerSize * 0.1));
    let borderEdgePixels = 0;
    let borderTotal = 0;

    // Scan along the top and left border of the corner region
    for (let x = startX; x < startX + cornerSize && x < width; x += 2) {
      for (let by = startY; by < startY + borderDepth && by < height; by += 2) {
        const gx = getBrightnessAt(x + 1, by) - getBrightnessAt(x - 1, by);
        const gy = getBrightnessAt(x, by + 1) - getBrightnessAt(x, by - 1);
        if (Math.sqrt(gx * gx + gy * gy) > 0.12) borderEdgePixels++;
        borderTotal++;
      }
    }
    // Also scan the left border
    for (let y = startY; y < startY + cornerSize && y < height; y += 2) {
      for (let bx = startX; bx < startX + borderDepth && bx < width; bx += 2) {
        const gx = getBrightnessAt(bx + 1, y) - getBrightnessAt(bx - 1, y);
        const gy = getBrightnessAt(bx, y + 1) - getBrightnessAt(bx, y - 1);
        if (Math.sqrt(gx * gx + gy * gy) > 0.12) borderEdgePixels++;
        borderTotal++;
      }
    }

    const borderEdgeRatio = borderTotal > 0 ? borderEdgePixels / borderTotal : 0;

    // Interior must have high edge density (minimaps show terrain features)
    const margin = Math.floor(cornerSize * 0.2);
    const interiorW = cornerSize - 2 * margin;
    const interiorH = cornerSize - margin; // allow bottom portion
    if (interiorW < 10 || interiorH < 10) return false;

    let interiorEdges = 0;
    let interiorTotal = 0;
    for (let iy = startY + margin; iy < startY + margin + interiorH && iy < height; iy += 2) {
      for (let ix = startX + margin; ix < startX + margin + interiorW && ix < width; ix += 2) {
        const gx = getBrightnessAt(ix + 1, iy) - getBrightnessAt(ix - 1, iy);
        const gy = getBrightnessAt(ix, iy + 1) - getBrightnessAt(ix, iy - 1);
        if (Math.sqrt(gx * gx + gy * gy) > 0.12) interiorEdges++;
        interiorTotal++;
      }
    }
    const interiorEdgeRatio = interiorTotal > 0 ? interiorEdges / interiorTotal : 0;

    // Compare interior brightness to frame center (minimaps are visually distinct)
    const cx = Math.floor(width * 0.3);
    const cy = Math.floor(height * 0.3);
    let centerBright = 0;
    let centerSamples = 0;
    for (let yy = cy; yy < cy + Math.floor(height * 0.3) && yy < height; yy += 3) {
      for (let xx = cx; xx < cx + Math.floor(width * 0.3) && xx < width; xx += 3) {
        centerBright += getBrightnessAt(xx, yy);
        centerSamples++;
      }
    }
    const avgCenterBright = centerSamples > 0 ? centerBright / centerSamples : 0.5;

    // Calculate interior average brightness
    let interiorBright = 0;
    let interiorBrightCount = 0;
    for (let iy = startY + margin; iy < startY + margin + interiorH && iy < height; iy += 2) {
      for (let ix = startX + margin; ix < startX + margin + interiorW && ix < width; ix += 2) {
        interiorBright += getBrightnessAt(ix, iy);
        interiorBrightCount++;
      }
    }
    const avgInteriorBright = interiorBrightCount > 0 ? interiorBright / interiorBrightCount : 0.5;
    const brightDiff = Math.abs(avgInteriorBright - avgCenterBright);

    // A minimap has: clear border, high interior detail, and distinct visual content
    const hasBorder = borderEdgeRatio > 0.10;
    const hasDetail = interiorEdgeRatio > 0.08;
    const isDistinct = brightDiff > 0.12;

    return hasBorder && hasDetail && isDistinct;
  }

  const topLeft = analyzeCorner(0, 0);
  const topRight = analyzeCorner(width - cornerSize, 0);
  const bottomLeft = analyzeCorner(0, height - cornerSize);
  const bottomRight = analyzeCorner(width - cornerSize, height - cornerSize);

  return { minimapDetected: topLeft || topRight || bottomLeft || bottomRight, minimapCornerCount: [topLeft, topRight, bottomLeft, bottomRight].filter(Boolean).length };
}

function detectTextOverlays(rawPixels, width, height, channels) {
  // Look for dense clusters of small high-contrast edges (text characters)
  // Text creates alternating bright/dark patterns at small scale
  const step = 3;
  const edgeClusters = [];
  const processed = new Set();

  function getBrightness(x, y) {
    const offset = (y * width + x) * channels;
    return pixelBrightness(rawPixels[offset], rawPixels[offset + 1], rawPixels[offset + 2]);
  }

  // Find edge points and cluster them
  for (let y = 2; y < height - 2; y += step) {
    for (let x = 2; x < width - 2; x += step) {
      const b = getBrightness(x, y);
      const leftB = getBrightness(x - 1, y);
      const rightB = getBrightness(x + 1, y);
      const topB = getBrightness(x, y - 1);
      const bottomB = getBrightness(x, y + 1);
      const edgeMag = Math.abs(b - leftB) + Math.abs(b - rightB) + Math.abs(b - topB) + Math.abs(b - bottomB);

      if (edgeMag > 1.0) { // high contrast edge
        const key = `${Math.floor(x / 8)},${Math.floor(y / 8)}`;
        if (!processed.has(key)) {
          processed.add(key);
          edgeClusters.push({ x, y, mag: edgeMag });
        }
      }
    }
  }

  // Count how many dense clusters we have
  // Text characters create dense groups of these edge points
  const clusterThreshold = Math.max(4, (width * height) / (320 * 180));
  return { textClusters: edgeClusters.length, denseText: edgeClusters.length > clusterThreshold };
}

function detectNaturalScene(rawPixels, width, height, channels, brightnessValues) {
  let greenDominant = 0;
  let blueUpper = 0;
  let totalSampled = 0;
  let upperSampled = 0;
  let totalSaturation = 0;
  let satSampled = 0;
  let upperBRight = 0;
  let lowerBRight = 0;
  const hueCounts = {};

  const step = 8;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * channels;
      const r = rawPixels[offset];
      const g = rawPixels[offset + 1];
      const b = rawPixels[offset + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;
      totalSaturation += sat;
      satSampled++;

      // Track hue concentration
      const hue = rgbToHue(r, g, b);
      if (hue >= 0) {
        const bucket = Math.floor(hue / 30);
        hueCounts[bucket] = (hueCounts[bucket] || 0) + 1;
      }

      if (g > r && g > b && g > r * 1.2) {
        greenDominant++;
      }

      if (y < height * 0.45) {
        if (b > r && b > g && b > r * 1.1) {
          blueUpper++;
        }
        upperBRight += brightnessValues ? brightnessValues[y * width + x] : 0;
        upperSampled++;
      } else {
        lowerBRight += brightnessValues ? brightnessValues[y * width + x] : 0;
      }
      totalSampled++;
    }
  }

  const vegetationRatio = totalSampled > 0 ? greenDominant / totalSampled : 0;
  const skyRatio = upperSampled > 0 ? blueUpper / upperSampled : 0;
  const avgSaturation = satSampled > 0 ? totalSaturation / satSampled : 0;
  const avgUpperBright = upperSampled > 0 ? upperBRight / upperSampled : 0.5;
  const avgLowerBright = (totalSampled - upperSampled) > 0 ? lowerBRight / (totalSampled - upperSampled) : 0.5;
  const brightGradient = avgUpperBright - avgLowerBright;

  // Color concentration: nature has large areas of similar hue (sky, water, vegetation)
  const totalHued = Object.values(hueCounts).reduce((a, b) => a + b, 0);
  let top2Concentration = 0;
  const sortedHues = Object.values(hueCounts).sort((a, b) => b - a);
  if (sortedHues.length >= 2) {
    top2Concentration = (sortedHues[0] + sortedHues[1]) / totalHued;
  } else if (sortedHues.length === 1) {
    top2Concentration = 1;
  }

  let naturalScore = 0;

  // Strong vegetation signal
  if (vegetationRatio > 0.12) naturalScore += 30;
  else if (vegetationRatio > 0.05) naturalScore += 15;

  // Strong sky signal in upper half
  if (skyRatio > 0.25) naturalScore += 30;
  else if (skyRatio > 0.12) naturalScore += 15;
  else if (skyRatio > 0.05) naturalScore += 5;

  // Color concentration (nature concentrates in fewer hue buckets)
  if (top2Concentration > 0.45) naturalScore += 20;
  else if (top2Concentration > 0.35) naturalScore += 10;

  // Brightness gradient (sky brighter than ground = outdoor nature)
  if (brightGradient > 0.12) naturalScore += 15;
  else if (brightGradient > 0.06) naturalScore += 8;

  // Very low vegetation + high sky = distinct natural pattern (ocean/beach/desert scenes)
  if (vegetationRatio < 0.02 && skyRatio > 0.20 && brightGradient > 0.05) {
    naturalScore += 15;
  }

  return {
    vegetationRatio,
    skyRatio,
    avgSaturation,
    brightGradient,
    top2Concentration,
    naturalScore,
    isNaturalScene: naturalScore > 50,
  };
}

function detectIndoorScene(rawPixels, width, height, channels, brightnessValues) {
  // Detects indoor environments: skin tones, warm lighting, uniform backgrounds
  let skinPixels = 0;
  let warmPixels = 0;
  let uniformBgPixels = 0;
  let totalCenter = 0;
  const step = 6;
  const hueCounts = {};

  // Focus on center region where facecam would appear
  const cx = Math.floor(width * 0.25);
  const cy = Math.floor(height * 0.15);
  const cw = Math.floor(width * 0.5);
  const ch = Math.floor(height * 0.5);

  for (let y = cy; y < cy + ch && y < height; y += step) {
    for (let x = cx; x < cx + cw && x < width; x += step) {
      const offset = (y * width + x) * channels;
      const r = rawPixels[offset];
      const g = rawPixels[offset + 1];
      const b = rawPixels[offset + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max > 0 ? (max - min) / max : 0;

      const hue = rgbToHue(r, g, b);
      if (hue >= 0) {
        const bucket = Math.floor(hue / 30);
        hueCounts[bucket] = (hueCounts[bucket] || 0) + 1;
      }

      // Skin tone: hue 10-50 (orange/yellow-red), moderate saturation, bright
      if (hue >= 10 && hue <= 50 && sat > 0.08 && sat < 0.6 && brightnessValues[y * width + x] > 0.2) {
        skinPixels++;
      }

      // Warm color cast (orange/red dominant)
      if (r > g && r > b && r > g * 1.15 && r > b * 1.15) {
        warmPixels++;
      }

      totalCenter++;
    }
  }

  // Check background uniformity in upper portion (wall/ceiling)
  const upperBand = Math.floor(height * 0.35);
  let bgVariance = 0;
  let bgSamples = 0;
  let prevBright = -1;
  for (let y = 0; y < upperBand; y += step) {
    for (let x = 0; x < width; x += step) {
      const brightness = brightnessValues[y * width + x];
      if (prevBright >= 0) {
        bgVariance += Math.abs(brightness - prevBright);
        bgSamples++;
      }
      prevBright = brightness;
    }
  }
  const avgBgVariance = bgSamples > 0 ? bgVariance / bgSamples : 1;

  const skinRatio = totalCenter > 0 ? skinPixels / totalCenter : 0;
  const warmRatio = totalCenter > 0 ? warmPixels / totalCenter : 0;
  const hueCount = Object.keys(hueCounts).length;

  let indoorScore = 0;
  if (skinRatio > 0.03) indoorScore += 30;
  else if (skinRatio > 0.015) indoorScore += 15;

  if (warmRatio > 0.12) indoorScore += 25;
  else if (warmRatio > 0.06) indoorScore += 12;

  if (avgBgVariance < 0.04) indoorScore += 20;
  else if (avgBgVariance < 0.07) indoorScore += 10;

  if (hueCount <= 4 && hueCount > 0) indoorScore += 15;

  return { indoorDetected: indoorScore > 45, indoorScore };
}

function detectScreenRecording(rawPixels, width, height, channels, brightnessValues) {
  // Detect desktop UI elements: taskbar, title bars, window frames
  let bottomBarScore = 0;
  let topBarScore = 0;
  let sideBorderScore = 0;

  // Check bottom ~5% for taskbar-like bar
  const barHeight = Math.max(8, Math.floor(height * 0.05));
  const barStartY = height - barHeight;

  // Check if bottom bar has distinct color from the content above
  let bottomBarBright = 0;
  let aboveBarBright = 0;
  for (let x = 2; x < width - 2; x += 4) {
    const bottomIdx = (barStartY + 2) * width + x;
    const aboveIdx = (barStartY - 4) * width + x;
    bottomBarBright += brightnessValues[bottomIdx] || 0;
    aboveBarBright += brightnessValues[aboveIdx] || 0;
  }
  const bottomSamples = Math.floor((width - 4) / 4);
  const avgBottomBar = bottomSamples > 0 ? bottomBarBright / bottomSamples : 0.5;
  const avgAboveBar = bottomSamples > 0 ? aboveBarBright / bottomSamples : 0.5;
  const bottomDiff = Math.abs(avgBottomBar - avgAboveBar);

  // Taskbar typically has a clear brightness difference
  if (bottomDiff > 0.15) bottomBarScore = 25;
  else if (bottomDiff > 0.08) bottomBarScore = 12;

  // Check for title bar at top (small band of uniform color)
  const titleBarHeight = Math.max(6, Math.floor(height * 0.03));
  let topUniformity = 0;
  let topSamples = 0;
  for (let y = 0; y < titleBarHeight; y += 2) {
    for (let x = 2; x < width - 2; x += 4) {
      const idx = y * width + x;
      const leftB = brightnessValues[idx - 1] || brightnessValues[idx];
      const rightB = brightnessValues[idx + 1] || brightnessValues[idx];
      topUniformity += Math.abs(leftB - rightB);
      topSamples++;
    }
  }
  const avgTopUniformity = topSamples > 0 ? topUniformity / topSamples : 0.5;

  // Title bar has low internal variation
  if (avgTopUniformity < 0.015) topBarScore = 20;
  else if (avgTopUniformity < 0.03) topBarScore = 10;

  // Check left/right edges for window borders (thin vertical bands)
  const borderWidth = Math.max(4, Math.floor(width * 0.02));
  let leftEdgeVar = 0;
  let rightEdgeVar = 0;
  let edgeSamples = 0;
  for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y += 3) {
    const lidx = y * width + borderWidth;
    const ridx = y * width + (width - borderWidth);
    leftEdgeVar += brightnessValues[lidx] || 0;
    rightEdgeVar += brightnessValues[ridx] || 0;
    edgeSamples++;
  }
  const avgLeftEdge = edgeSamples > 0 ? leftEdgeVar / edgeSamples : 0.5;
  const avgRightEdge = edgeSamples > 0 ? rightEdgeVar / edgeSamples : 0.5;
  const leftRightDiff = Math.abs(avgLeftEdge - avgRightEdge);

  if (leftRightDiff < 0.05 && avgLeftEdge > 0.1) sideBorderScore = 15;

  const screenRecScore = bottomBarScore + topBarScore + sideBorderScore;
  return { screenRecordingDetected: screenRecScore > 30, screenRecScore };
}

function detectAnimation(rawPixels, width, height, channels, brightnessValues) {
  // Detects animation/cartoon: flat color regions, thick sharp edges, no photo texture
  const step = 4;
  let flatRegionPixels = 0;
  let totalSampledInner = 0;
  let thickEdges = 0;
  let thinEdges = 0;
  let totalEdgeMag = 0;
  let edgeCount = 0;

  for (let y = 2; y < height - 2; y += step) {
    for (let x = 2; x < width - 2; x += step) {
      const idx = y * width + x;
      const left = brightnessValues[idx - 1];
      const right = brightnessValues[idx + 1];
      const top = brightnessValues[(y - 1) * width + x];
      const bottom = brightnessValues[(y + 1) * width + x];
      const gx = right - left;
      const gy = bottom - top;
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > 0.05) {
        totalEdgeMag += mag;
        edgeCount++;
        if (mag > 0.3) thickEdges++;
        else thinEdges++;
      }

      totalSampledInner++;

      // Flat region: very low local variance
      if (mag < 0.02) flatRegionPixels++;
    }
  }

  const flatRatio = totalSampledInner > 0 ? flatRegionPixels / totalSampledInner : 0;
  const avgEdgeMag = edgeCount > 0 ? totalEdgeMag / edgeCount : 0;
  const thickToThinRatio = thinEdges > 0 ? thickEdges / thinEdges : 0;

  let animScore = 0;

  // Cartoons have large flat color areas
  if (flatRatio > 0.65) animScore += 35;
  else if (flatRatio > 0.5) animScore += 20;

  // Cartoons have sharp, thick edges (high magnitude per edge)
  if (avgEdgeMag > 0.35) animScore += 25;
  else if (avgEdgeMag > 0.25) animScore += 12;

  // Cartoons have more thick edges relative to thin edges
  if (thickToThinRatio > 0.5) animScore += 20;
  else if (thickToThinRatio > 0.3) animScore += 10;

  return { isAnimation: animScore > 50, animationScore: animScore };
}

async function analyzeFrame(framePath) {
  const image = sharp(framePath);
  const metadata = await image.metadata();
  const { width, height, channels } = metadata;

  const rawPixels = await image.raw().toBuffer();
  const pixelCount = width * height;

  // --- Brightness analysis ---
  let totalBrightness = 0;
  let brightPixels = 0;
  let darkPixels = 0;
  const brightnessValues = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * channels;
    const r = rawPixels[offset];
    const g = rawPixels[offset + 1];
    const b = rawPixels[offset + 2];
    const brightness = pixelBrightness(r, g, b);
    brightnessValues[i] = brightness;
    totalBrightness += brightness;
    if (brightness > 0.7) brightPixels++;
    if (brightness < 0.15) darkPixels++;
  }
  const avgBrightness = totalBrightness / pixelCount;
  const brightRatio = brightPixels / pixelCount;
  const darkRatio = darkPixels / pixelCount;

  // --- Color diversity (unique hue buckets) ---
  const hueBuckets = new Uint8Array(360);
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * channels;
    const r = rawPixels[offset];
    const g = rawPixels[offset + 1];
    const b = rawPixels[offset + 2];
    const hue = rgbToHue(r, g, b);
    if (hue >= 0) hueBuckets[Math.round(hue)]++;
  }
  const colorDiversity = hueBuckets.filter(v => v > pixelCount * 0.001).length;

  // --- Edge detection (Sobel-like) ---
  let edgeCount = 0;
  let highEdgeCount = 0;
  const step = 4;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = y * width + x;
      const left = brightnessValues[idx - 1];
      const right = brightnessValues[idx + 1];
      const top = brightnessValues[(y - 1) * width + x];
      const bottom = brightnessValues[(y + 1) * width + x];
      const gx = right - left;
      const gy = bottom - top;
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude > 0.15) edgeCount++;
      if (magnitude > 0.35) highEdgeCount++;
    }
  }
  const totalSampled = Math.floor((height - 2) / step) * Math.floor((width - 2) / step);
  const edgeDensity = totalSampled > 0 ? edgeCount / totalSampled : 0;
  const highContrastEdgeRatio = edgeCount > 0 ? highEdgeCount / edgeCount : 0;

  // --- HUD edge detection (corner regions) ---
  const cornerSize = Math.min(60, Math.floor(width * 0.08), Math.floor(height * 0.08));
  const corners = [
    { x: 0, y: 0 },
    { x: width - cornerSize, y: 0 },
    { x: 0, y: height - cornerSize },
    { x: width - cornerSize, y: height - cornerSize },
  ];

  let hudEdgeScore = 0;
  for (const corner of corners) {
    let cornerEdgeCount = 0;
    let cornerPixelCount = 0;
    for (let y = corner.y + 1; y < corner.y + cornerSize - 1; y += 2) {
      for (let x = corner.x + 1; x < corner.x + cornerSize - 1; x += 2) {
        if (y >= height || x >= width) continue;
        const idx = y * width + x;
        const left = brightnessValues[idx - 1] || 0;
        const right = brightnessValues[idx + 1] || 0;
        const top = brightnessValues[(y - 1) * width + x] || brightnessValues[idx];
        const bottom = brightnessValues[(y + 1) * width + x] || brightnessValues[idx];
        const gx = right - left;
        const gy = bottom - top;
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude > 0.2) cornerEdgeCount++;
        cornerPixelCount++;
      }
    }
    if (cornerPixelCount > 0) {
      hudEdgeScore += cornerEdgeCount / cornerPixelCount;
    }
  }
  hudEdgeScore /= corners.length;

  // --- Contrast analysis ---
  let variance = 0;
  for (let i = 0; i < pixelCount; i++) {
    const diff = brightnessValues[i] - avgBrightness;
    variance += diff * diff;
  }
  const contrast = Math.sqrt(variance / pixelCount);

  // --- Game-specific UI element detection ---
  const crosshair = detectCrosshair(rawPixels, width, height, channels, brightnessValues);
  const hudBars = detectHUDBars(rawPixels, width, height, channels);
  const minimap = detectMinimap(rawPixels, width, height, channels, brightnessValues);
  const text = detectTextOverlays(rawPixels, width, height, channels);
  const natural = detectNaturalScene(rawPixels, width, height, channels, brightnessValues);
  const indoor = detectIndoorScene(rawPixels, width, height, channels, brightnessValues);
  const screenRec = detectScreenRecording(rawPixels, width, height, channels, brightnessValues);
  const animation = detectAnimation(rawPixels, width, height, channels, brightnessValues);

  return {
    avgBrightness,
    brightRatio,
    darkRatio,
    colorDiversity,
    edgeDensity,
    highContrastEdgeRatio,
    hudEdgeScore,
    contrast,
    crosshairDetected: crosshair.detected,
    hudBarsDetected: hudBars.hudBarsDetected,
    hudBarCount: hudBars.hudBarCount,
    minimapDetected: minimap.minimapDetected,
    minimapCornerCount: minimap.minimapCornerCount,
    textClusters: text.textClusters,
    textDense: text.denseText,
    vegetationRatio: natural.vegetationRatio,
    skyRatio: natural.skyRatio,
    avgSaturation: natural.avgSaturation,
    brightGradient: natural.brightGradient,
    top2Concentration: natural.top2Concentration,
    naturalScore: natural.naturalScore,
    isNaturalScene: natural.isNaturalScene,
    indoorDetected: indoor.indoorDetected,
    indoorScore: indoor.indoorScore,
    screenRecordingDetected: screenRec.screenRecordingDetected,
    screenRecScore: screenRec.screenRecScore,
    isAnimation: animation.isAnimation,
    animationScore: animation.animationScore,
  };
}

function aggregateFrameAnalyses(frameResults) {
  if (frameResults.length === 0) {
    return null;
  }

  const avg = (arr, key) => arr.reduce((s, f) => s + (f[key] || 0), 0) / arr.length;

  const aggregated = {
    avgBrightness: avg(frameResults, 'avgBrightness'),
    avgEdgeDensity: avg(frameResults, 'avgEdgeDensity'),
    avgHudEdge: avg(frameResults, 'hudEdgeScore'),
    avgColorDiversity: avg(frameResults, 'colorDiversity'),
    avgContrast: avg(frameResults, 'contrast'),
    avgHighContrastEdgeRatio: avg(frameResults, 'highContrastEdgeRatio'),
    avgSaturation: avg(frameResults, 'avgSaturation'),
    crosshairDetected: frameResults.some(f => f.crosshairDetected),
    hudBarsDetected: frameResults.some(f => f.hudBarsDetected),
    avgHudBarCount: avg(frameResults, 'hudBarCount'),
    minimapDetected: frameResults.some(f => f.minimapDetected),
    avgMinimapCornerCount: avg(frameResults, 'minimapCornerCount'),
    avgTextClusters: avg(frameResults, 'textClusters'),
    textDenseDetected: frameResults.some(f => f.textDense),
    avgVegetationRatio: avg(frameResults, 'vegetationRatio'),
    avgSkyRatio: avg(frameResults, 'skyRatio'),
    avgBrightGradient: avg(frameResults, 'brightGradient'),
    avgTop2Concentration: avg(frameResults, 'top2Concentration'),
    avgNaturalScore: avg(frameResults, 'naturalScore'),
    isNaturalScene: frameResults.some(f => f.isNaturalScene),
    indoorDetected: frameResults.some(f => f.indoorDetected),
    avgIndoorScore: avg(frameResults, 'indoorScore'),
    screenRecordingDetected: frameResults.some(f => f.screenRecordingDetected),
    avgScreenRecScore: avg(frameResults, 'screenRecScore'),
    isAnimation: frameResults.some(f => f.isAnimation),
    avgAnimationScore: avg(frameResults, 'animationScore'),
  };

  // Stage 1: Negative signals
  const hasStrongUI = aggregated.crosshairDetected || aggregated.hudBarsDetected;
  const hasAnyUI = hasStrongUI || aggregated.minimapDetected || aggregated.textDenseDetected;

  if (aggregated.isNaturalScene && !hasAnyUI) {
    aggregated.gameplayConfidence = 0;
    aggregated.stage1Pass = false;
    return aggregated;
  }

  // Stage 1b: Reject indoor / screen recording / animation WITHOUT any game UI
  const hasAnyNonGamingSignal = aggregated.indoorDetected || aggregated.screenRecordingDetected || aggregated.isAnimation;
  if (hasAnyNonGamingSignal && !hasAnyUI) {
    aggregated.gameplayConfidence = 0;
    aggregated.stage1Pass = false;
    return aggregated;
  }

  aggregated.stage1Pass = true;

  // Stage 2: Positive signals
  let score = 0;

  // Game UI elements (required signals)
  const hasCrosshair = aggregated.crosshairDetected;
  const hasHudBars = aggregated.hudBarsDetected;
  const hasMinimap = aggregated.minimapDetected;
  const hasGameUI = hasCrosshair || hasHudBars || hasMinimap;

  // Tier 1: Strong UI indicators (highest confidence)
  if (hasCrosshair) score += 40;
  if (hasHudBars) {
    score += 30;
    if (aggregated.avgHudBarCount > 1) score += 5;
  }

  // Tier 2: Medium UI indicators
  if (hasMinimap && (hasCrosshair || hasHudBars)) {
    score += 15;
  } else if (hasMinimap) {
    score += 5;
  }

  if (aggregated.textDenseDetected && (hasCrosshair || hasHudBars)) {
    score += 10;
  } else if (aggregated.textDenseDetected && hasMinimap) {
    score += 5;
  }

  // Tier 3: General heuristics (fallback - used when no specific UI found)
  // These catch cases where UI is present but too small/blurred for specific detection
  let heuristicScore = 0;

  // HUD corner edges (game UI in corners)
  if (aggregated.avgHudEdge > 0.1) heuristicScore += 15;
  else if (aggregated.avgHudEdge > 0.06) heuristicScore += 8;
  else if (aggregated.avgHudEdge > 0.03) heuristicScore += 3;

  // Edge density (games have moderate to high edge density)
  if (aggregated.avgEdgeDensity > 0.06 && aggregated.avgEdgeDensity < 0.35) heuristicScore += 12;
  else if (aggregated.avgEdgeDensity > 0.03 && aggregated.avgEdgeDensity < 0.45) heuristicScore += 6;

  // Color diversity (games have diverse artificial colors)
  if (aggregated.avgColorDiversity > 15 && aggregated.avgColorDiversity < 100) heuristicScore += 10;
  else if (aggregated.avgColorDiversity > 8) heuristicScore += 4;

  // High-contrast edge ratio (game UI has sharp edges)
  if (aggregated.avgHighContrastEdgeRatio > 0.1) heuristicScore += 12;
  else if (aggregated.avgHighContrastEdgeRatio > 0.06) heuristicScore += 6;

  // Saturation (games are more saturated than most natural content)
  if (aggregated.avgSaturation > 0.4) heuristicScore += 10;
  else if (aggregated.avgSaturation > 0.3) heuristicScore += 5;

  // Brightness range
  if (aggregated.avgBrightness > 0.2 && aggregated.avgBrightness < 0.7) heuristicScore += 5;

  // Contrast
  if (aggregated.avgContrast > 0.1 && aggregated.avgContrast < 0.45) heuristicScore += 5;

  // If no specific UI found, weight heuristic lower by default, but allow it to carry
  if (hasGameUI) {
    score += heuristicScore;
  } else {
    // No specific UI — rely on heuristics with higher bar
    score += Math.round(heuristicScore * 0.7);
    // Text density as final fallback signal
    if (aggregated.textDenseDetected && heuristicScore > 25) score += 8;
  }

  // Apply natural scene penalty if mixed with game UI (outdoor game like PUBG, Valorant)
  if (aggregated.isNaturalScene) {
    score = Math.max(0, score - 20);
  }

  aggregated.gameplayConfidence = Math.min(score, 100);
  return aggregated;
}

function isGameplayVideo(metadata, frameAnalysis) {
  const reasons = [];

  const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video');
  if (!videoStream) {
    return { isGameplay: false, reasons: ['No video stream found'], metadata: {}, frameAnalysis: null };
  }

  const width = videoStream.width || 0;
  const height = videoStream.height || 0;
  const fpsParts = (videoStream.r_frame_rate || '0/1').split('/');
  const fps = parseInt(fpsParts[0], 10) / (parseInt(fpsParts[1], 10) || 1);
  const duration = parseFloat(metadata.format?.duration || 0);
  const fileSize = parseInt(metadata.format?.size || 0, 10);
  const bitrate = parseInt(metadata.format?.bit_rate || 0, 10);
  const codec = videoStream.codec_name || '';
  const minDimension = Math.min(width, height);
  const aspect = width && height ? width / height : 0;

  // --- Metadata checks ---
  if (!width || !height) {
    reasons.push('Could not determine video resolution');
  }
  if (minDimension > 0 && minDimension < 480) {
    reasons.push(`Resolution too low (${width}x${height}) for gameplay footage`);
  }
  if (aspect > 0 && (aspect < 1.2 || aspect > 2.5)) {
    reasons.push(`Unusual aspect ratio (${aspect.toFixed(2)}) for gameplay`);
  }
  if (fps > 0 && fps < 15) {
    reasons.push(`Frame rate too low (${fps.toFixed(1)} FPS) for gameplay recording`);
  }
  if (duration > 0 && duration < 5) {
    reasons.push(`Video too short (${duration.toFixed(1)}s) to contain gameplay`);
  }
  if (duration > 0 && duration > 3600) {
    reasons.push(`Video too long (${(duration / 60).toFixed(0)}min) for a gameplay clip`);
  }
  if (fileSize > 0 && fileSize < 100 * 1024) {
    reasons.push(`File too small (${(fileSize / 1024).toFixed(0)}KB) for gameplay footage`);
  }

  // --- Bitrate check ---
  if (bitrate > 0 && width > 0 && height > 0) {
    const pixelsPerSecond = width * height * fps;
    const bitsPerPixel = (bitrate * 8) / pixelsPerSecond;
    if (bitsPerPixel < 0.01) {
      reasons.push(`Bitrate unusually low for video content (${(bitrate / 1000000).toFixed(1)}Mbps at ${width}x${height})`);
    }
  }

  // --- Codec check ---
  const validCodecs = ['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1', 'mpeg4', 'mpeg2'];
  if (codec && !validCodecs.includes(codec.toLowerCase())) {
    reasons.push(`Unusual codec (${codec}) for gameplay recording`);
  }

  // --- Frame analysis: reject if no frames could be analyzed ---
  if (!frameAnalysis) {
    reasons.push('Could not analyze video content — file may be corrupted or not a gameplay recording');
    return {
      isGameplay: false,
      reasons,
      metadata: {
        width, height,
        aspectRatio: aspect ? parseFloat(aspect.toFixed(4)) : 0,
        fps: parseFloat(fps.toFixed(2)),
        duration: parseFloat(duration.toFixed(2)),
        fileSize, bitrate, codec,
        hasAudio: (metadata.streams || []).some(s => s.codec_type === 'audio'),
      },
      frameAnalysis: null,
    };
  }

  // --- Frame analysis: Stage 1 check (natural scene rejection) ---
  if (!frameAnalysis.stage1Pass) {
    if (frameAnalysis.isNaturalScene) {
      reasons.push('Video appears to be a natural/outdoor scene, not gameplay footage');
    }
    if (frameAnalysis.indoorDetected) {
      reasons.push('Video appears to be an indoor/personal environment, not gameplay footage');
    }
    if (frameAnalysis.screenRecordingDetected) {
      reasons.push('Video appears to be a screen recording of a desktop window, not gameplay');
    }
    if (frameAnalysis.isAnimation) {
      reasons.push('Video appears to be an animation or cartoon, not gameplay footage');
    }
  }

  // --- Frame analysis: Stage 2 check (must detect game UI or strong visual patterns) ---
  const hasStrongUI = frameAnalysis.crosshairDetected || frameAnalysis.hudBarsDetected;
  const hasAnyUI = hasStrongUI || frameAnalysis.minimapDetected || frameAnalysis.textDenseDetected;

  // Phase 3.2: Static content rejection (unchanging frames = not gameplay)
  if (frameAnalysis.isStaticContent && !hasStrongUI) {
    reasons.push('Video content appears static or unchanging — not active gameplay');
  }

  if (!hasAnyUI) {
    if (frameAnalysis.gameplayConfidence < 60) {
      reasons.push('No game UI elements detected');
    }
  } else if (!hasStrongUI) {
    if (frameAnalysis.gameplayConfidence < 50) {
      reasons.push('No primary game UI elements detected (crosshair or HUD bars)');
    }
  }

  // --- Frame analysis: minimum confidence ---
  if (frameAnalysis.gameplayConfidence < 45 && reasons.length === 0) {
    reasons.push('Low gameplay confidence score');
  }

  return {
    isGameplay: reasons.length === 0,
    reasons,
    metadata: {
      width,
      height,
      aspectRatio: aspect ? parseFloat(aspect.toFixed(4)) : 0,
      fps: parseFloat(fps.toFixed(2)),
      duration: parseFloat(duration.toFixed(2)),
      fileSize,
      bitrate,
      codec,
      hasAudio: (metadata.streams || []).some(s => s.codec_type === 'audio'),
    },
    frameAnalysis,
  };
}

async function analyzeVideo(videoPath, selectedGame) {
  if (!fs.existsSync(videoPath)) {
    return { isGameplay: false, reasons: ['Video file not found'], metadata: {}, frameAnalysis: null };
  }

  let metadata;
  try {
    metadata = await getVideoMetadata(videoPath);
  } catch (err) {
    return { isGameplay: false, reasons: [`Failed to read video: ${err.message}`], metadata: {}, frameAnalysis: null };
  }

  const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video');
  const duration = parseFloat(metadata.format?.duration || 0);

  let frameAnalysis = null;
  let savedFramePaths = [];
  if (videoStream && duration > 0) {
    const tmpDir = path.join(path.dirname(videoPath), '_frames_' + Date.now());
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      const framePaths = await extractFrames(videoPath, duration, tmpDir);
      savedFramePaths = [...framePaths];
      if (framePaths.length === 0) {
        // No frames extracted — reject
        return {
          isGameplay: false,
          reasons: ['Could not extract frames from video for content analysis'],
          metadata: {},
          frameAnalysis: null,
        };
      }
      const frameResults = [];
      for (const fp of framePaths) {
        try {
          const result = await analyzeFrame(fp);
          frameResults.push(result);
        } catch (_) {}
      }

      // Phase 3.1: Reject if majority of frames failed analysis (>50% failure rate)
      const failureRate = (framePaths.length - frameResults.length) / framePaths.length;
      if (failureRate > 0.5) {
        return {
          isGameplay: false,
          reasons: [`Majority of frames (${Math.round(failureRate * 100)}%) failed analysis — video is not gameplay footage`],
          metadata: {},
          frameAnalysis: null,
        };
      }

      if (frameResults.length === 0) {
        return {
          isGameplay: false,
          reasons: ['Frame analysis failed — video may be corrupted or not gameplay'],
          metadata: {},
          frameAnalysis: null,
        };
      }
      frameAnalysis = aggregateFrameAnalyses(frameResults);

      // Phase 3.2: Inter-frame similarity check — detect static/unchanging content
      if (frameResults.length >= 3) {
        const brightnesses = frameResults.map(f => f.avgBrightness);
        const meanBright = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
        const variance = brightnesses.reduce((sum, b) => sum + (b - meanBright) ** 2, 0) / brightnesses.length;
        const cv = Math.sqrt(variance) / meanBright;
        frameAnalysis.interFrameCV = cv;
        frameAnalysis.isStaticContent = cv < 0.015;

        const edgeDensities = frameResults.map(f => f.edgeDensity);
        const meanEdge = edgeDensities.reduce((a, b) => a + b, 0) / edgeDensities.length;
        const edgeVar = edgeDensities.reduce((sum, e) => sum + (e - meanEdge) ** 2, 0) / edgeDensities.length;
        const edgeCv = Math.sqrt(edgeVar) / (meanEdge || 0.001);
        frameAnalysis.interFrameEdgeCV = edgeCv;
        // Mark static if BOTH brightness and edge density barely change
        if (cv < 0.012 && edgeCv < 0.08) {
          frameAnalysis.isStaticContent = true;
        }
      } else {
        frameAnalysis.interFrameCV = 0;
        frameAnalysis.interFrameEdgeCV = 0;
        frameAnalysis.isStaticContent = false;
      }

      // Stage 1: ML classifier on per-frame data (if available)
      let mlResult = null;
      if (frameResults.length > 0) {
        mlResult = await mlClassify(frameResults, selectedGame);
      }

      // If ML is confident, use it — otherwise fall back to rules + Ollama
      let result;
      if (mlResult && mlResult.success && mlResult.confidence >= 0.55) {
        result = isGameplayVideo(metadata, frameAnalysis);
        // Clear stale reasons — ML overrides the rule-based decision
        result.reasons = [];
        result.isGameplay = mlResult.isGameplay;
        if (!mlResult.isGameplay) {
          result.reasons.push('ML analysis indicates this is not gameplay footage');
        } else if (selectedGame && mlResult.detectedGame && !mlResult.gameMatch) {
          result.isGameplay = false;
          result.reasons.push(`This clip appears to be "${mlResult.detectedGame}" gameplay, not "${selectedGame}". Please select the correct game.`);
          result.detectedGame = mlResult.detectedGame;
          result.gameMatchError = true;
        } else {
          result.detectedGame = mlResult.detectedGame || selectedGame;
        }
        result.mlConfidence = mlResult.confidence;
      } else {
        // Fallback: existing rule-based logic + Ollama
        let aiOverruled = false;
        if (savedFramePaths.length > 0) {
          try {
            const aiAvailable = await ollamaAvailable();
            if (aiAvailable) {
              const aiResult = await checkWithOllama(savedFramePaths);
              if (aiResult.framesChecked > 0 && !aiResult.gameplayDetected) {
                aiOverruled = true;
              }
            }
          } catch (_) {}
        }

        result = isGameplayVideo(metadata, frameAnalysis);

        if (aiOverruled) {
          result.isGameplay = false;
          result.reasons.push('AI analysis (moondream) did not detect game UI elements');
        }
      }

      // Game-specific skill analysis (Phase 1 + Phase 2 YOLO)
      if (result.isGameplay && frameResults.length > 0) {
        try {
          const gameForAnalysis = result.detectedGame || selectedGame;
          if (gameForAnalysis) {
            // Phase 2: Run YOLO on a sample of frames for game element detection
            const sampleFrames = savedFramePaths.filter((_, i) => i % Math.max(1, Math.floor(savedFramePaths.length / 5)) === 0).slice(0, 5);
            let yoloData = null;
            if (sampleFrames.length > 0 && gameForAnalysis === 'Valorant') {
              const yoloResult = await runYOLO(sampleFrames);
              if (yoloResult && !yoloResult.error) yoloData = yoloResult;
            }
            result.gameSkillResult = await analyzeGameSkill(gameForAnalysis, savedFramePaths, frameResults, yoloData);
          }
        } catch (err) {
          console.warn('[GameSkill] Analysis failed:', err.message);
        }
      }

      return result;
    } catch (_) {
      return {
        isGameplay: false,
        reasons: ['Frame extraction failed — cannot verify gameplay content'],
        metadata: {},
        frameAnalysis: null,
      };
    } finally {
      try {
        if (fs.existsSync(tmpDir)) {
          fs.readdirSync(tmpDir).forEach(f => {
            try { fs.unlinkSync(path.join(tmpDir, f)); } catch (_) {}
          });
          fs.rmdirSync(tmpDir);
        }
      } catch (_) {}
    }
  } else {
    return {
      isGameplay: false,
      reasons: ['No video stream found or invalid duration'],
      metadata: {},
      frameAnalysis: null,
    };
  }
}

async function ollamaAvailable() {
  return new Promise((resolve) => {
    const req = http.get(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

async function checkWithOllama(framePaths) {
  const framesToCheck = framePaths.length >= 2
    ? [framePaths[0], framePaths[Math.floor(framePaths.length / 2)]]
    : [framePaths[0]];

  let gameplayVotes = 0;
  let totalChecks = 0;

  for (const framePath of framesToCheck) {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const imageBuffer = fs.readFileSync(framePath);
        const base64Image = imageBuffer.toString('base64');

        const prompt = `Analyze this video game frame. Does it contain gameplay with game UI elements like a crosshair (reticle), health bar, minimap, score display, ammo counter, or HUD elements? Answer only YES or NO.`;

        const response = await new Promise((resolve, reject) => {
          const payload = JSON.stringify({
            model: 'moondream',
            prompt: prompt,
            images: [base64Image],
            stream: false,
          });

          const options = {
            hostname: OLLAMA_HOST,
            port: OLLAMA_PORT,
            path: '/api/generate',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          };

          const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          });
          req.on('error', reject);
          req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
          req.write(payload);
          req.end();
        });

        if (response && response.response) {
          const text = response.response.toUpperCase();
          if (text.includes('YES')) {
            gameplayVotes++;
          }
          totalChecks++;
          break; // success — exit retry loop
        }
      } catch (_) {
        if (attempt === maxAttempts) {
          // Last attempt failed — skip this frame
        }
      }
    }
  }

  return {
    gameplayDetected: totalChecks > 0 && gameplayVotes === totalChecks,
    framesChecked: totalChecks,
    framesVotedYes: gameplayVotes,
  };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

async function extractThumbnail(videoPath, outputPath) {
  const metadata = await getVideoMetadata(videoPath);
  const duration = parseFloat(metadata.format?.duration || 0);
  const t = duration > 4 ? duration * 0.25 : 1;

  await runCommand(FFMPEG, [
    '-ss', String(t),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '3',
    '-vf', 'scale=640:-1',
    '-y',
    outputPath
  ], 15000);

  return outputPath;
}

/* ───────── ML Classifier Integration ───────── */

const ML_DIR = path.join(__dirname, '..', 'ml');
const PREDICT_SCRIPT = path.join(ML_DIR, 'predict.py');
const PYTHON = 'python';

// Per-frame feature keys — matches exactly what analyzeFrame() returns
const FEATURE_COLS = [
  'avgBrightness', 'edgeDensity', 'hudEdgeScore', 'colorDiversity',
  'contrast', 'highContrastEdgeRatio', 'avgSaturation',
  'crosshairDetected', 'hudBarsDetected', 'hudBarCount',
  'minimapDetected', 'minimapCornerCount',
  'textClusters', 'textDense',
  'vegetationRatio', 'skyRatio', 'brightGradient',
  'top2Concentration', 'naturalScore', 'isNaturalScene',
  'indoorDetected', 'indoorScore',
  'screenRecordingDetected', 'screenRecScore',
  'isAnimation', 'animationScore',
];

function featuresToArray(frameResult) {
  return FEATURE_COLS.map(key => {
    const v = frameResult[key];
    return typeof v === 'boolean' ? (v ? 1 : 0) : (v || 0);
  });
}

async function mlClassify(frameResults, selectedGame) {
  try {
    const featureArrays = frameResults.map(f => featuresToArray(f));
    const payload = JSON.stringify({ frames: featureArrays, gameTitle: selectedGame || '' });
    const result = await new Promise((resolve, reject) => {
      const proc = execFile(PYTHON, [PREDICT_SCRIPT], {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      }, (err, stdout, stderr) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (e) {
          reject(new Error('Invalid JSON from predict.py: ' + stdout.trim().slice(0, 200)));
        }
      });
      proc.stdin.write(payload);
      proc.stdin.end();
    });
    return {
      success: true,
      isGameplay: result.isGameplay === true,
      detectedGame: result.detectedGame || null,
      confidence: result.confidence || 0,
      gameMatch: result.gameMatch === true,
    };
  } catch (err) {
    console.warn('[ML] Classifier unavailable, falling back to rules:', err.message);
    return { success: false };
  }
}

module.exports = { analyzeVideo, extractThumbnail, analyzeFrame, extractFrames, getVideoMetadata, aggregateFrameAnalyses, isGameplayVideo, mlClassify, FEATURE_COLS, featuresToArray };
