const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'yolo', 'detect.py');

let modelWarm = false;

function warmModel() {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [SCRIPT_PATH], { windowsHide: true });
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', () => {});
    proc.on('close', code => {
      modelWarm = true;
      resolve();
    });
    proc.on('error', reject);
    setTimeout(() => { proc.kill(); resolve(); }, 10000);
  });
}

function runYOLO(framePaths) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(framePaths)) framePaths = [framePaths];
    const proc = spawn('python', [SCRIPT_PATH, ...framePaths], { windowsHide: true });
    let output = '';
    let error = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => error += d);
    proc.on('close', code => {
      if (code !== 0) {
        resolve({ error: error.trim() || `Exit code ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(output));
      } catch (e) {
        resolve({ error: 'Failed to parse YOLO output', raw: output });
      }
    });
    proc.on('error', e => resolve({ error: e.message }));
  });
}

module.exports = { runYOLO, warmModel };
