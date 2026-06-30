const fs = require('fs');
const path = require('path');
const { analyzeFrame, extractFrames, getVideoMetadata, aggregateFrameAnalyses, FEATURE_COLS, featuresToArray } = require('../services/videoAnalyzer');

const TRAINING_DIR = path.join(__dirname, '..', 'training');
const OUTPUT_CSV = path.join(__dirname, 'features.csv');

const GAME_LABEL_MAP = {
  'gameplay': 'unknown',
};
const GAME_KNOWN = ['Valorant', 'tekken 8', 'PUBG Mobile'];

function detectGameLabel(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes('valorant')) return 'Valorant';
  if (lower.includes('tekken') || lower.includes('tk8') || lower.includes('tekken 8')) return 'Tekken 8';
  if (lower.includes('pubg') || lower.includes('pubg mobile')) return 'PUBG Mobile';
  if (lower.includes('bgmi')) return 'PUBG Mobile';
  return 'unknown';
}

async function processVideo(videoPath, label) {
  const videoName = path.basename(videoPath);
  console.log(`  [${label}] Processing ${videoName}...`);
  let metadata;
  try {
    metadata = await getVideoMetadata(videoPath);
  } catch (err) {
    console.error(`    Failed to read metadata: ${err.message}`);
    return [];
  }

  const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video');
  const duration = parseFloat(metadata.format?.duration || 0);
  if (!videoStream || duration <= 0) {
    console.error(`    No video stream or invalid duration`);
    return [];
  }

  const tmpDir = path.join(path.dirname(videoPath), '_fe_' + Date.now());
  const rows = [];
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const framePaths = await extractFrames(videoPath, duration, tmpDir);
    if (framePaths.length === 0) {
      console.error(`    No frames extracted`);
      return [];
    }

    for (const fp of framePaths) {
      try {
        const result = await analyzeFrame(fp);
        const featureArray = featuresToArray(result);
        rows.push({ label, videoName, features: featureArray });
      } catch (e) {
        // skip failed frame
      }
    }

    if (rows.length === 0) {
      console.error(`    All frames failed analysis`);
    } else {
      console.log(`    Extracted ${rows.length} frames`);
    }
    return rows;
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.readdirSync(tmpDir).forEach(f => {
        try { fs.unlinkSync(path.join(tmpDir, f)); } catch (_) {}
      });
      fs.rmdirSync(tmpDir);
    }
  }
}

function walkVideos(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkVideos(fullPath, results);
    } else if (entry.isFile() && /\.(mp4|webm|mov|mkv|avi)$/i.test(entry.name)) {
      const parentDir = path.basename(path.dirname(fullPath));
      const label = detectGameLabel(fullPath);
      results.push({ path: fullPath, label: label === 'unknown' ? (parentDir === 'gameplay' ? 'unknown' : 'Non-Gameplay') : label });
    }
  }
  return results;
}

async function main() {
  console.log('Walking training directory...');
  const videos = walkVideos(TRAINING_DIR);
  console.log(`Found ${videos.length} videos`);

  const labelCounts = {};
  const rows = [];

  for (const { path: videoPath, label } of videos) {
    const frameRows = await processVideo(videoPath, label);
    for (const r of frameRows) {
      rows.push(r);
    }
    labelCounts[label] = (labelCounts[label] || 0) + 1;
  }

  console.log('\nLabel distribution (videos):');
  for (const [label, count] of Object.entries(labelCounts)) {
    console.log(`  ${label}: ${count} videos`);
  }

  // Write CSV (one row per frame, no video_name to avoid commas in filenames)
  const header = ['game', ...FEATURE_COLS];
  const lines = rows.map(r => [r.label, ...r.features].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8');
  console.log(`\nWrote ${rows.length} frame-rows to ${OUTPUT_CSV}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
