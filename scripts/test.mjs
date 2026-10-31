#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const venvDir = path.join(ROOT_DIR, 'venv');
let pythonBin = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

if (!fs.existsSync(pythonBin)) {
  pythonBin = isWin ? 'python' : 'python3';
}

console.log('\n======================================================');
console.log('   Brightloop Subscription Management System: TESTS   ');
console.log('======================================================\n');

function run(cmd, args, options = {}) {
  const displayCmd = `${cmd} ${args.join(' ')}`;
  console.log(`[test] > ${displayCmd}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    shell: isWin,
    ...options,
  });

  if (result.error) {
    console.error(`[test] Failed:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[test] Exited with code ${result.status}`);
    process.exit(result.status || 1);
  }
  return result;
}

const pyEnv = {
  ...process.env,
  PYTHONPATH: path.join(ROOT_DIR, 'backend'),
};

// 1. Pytest suite
console.log('\n[test] Running Backend Pytest Suite...');
run(pythonBin, ['-m', 'pytest', 'backend/tests', '-v'], { env: pyEnv });

// 2. API Smoke test
const smokeScript = path.join(ROOT_DIR, 'scripts', 'api_smoke.py');
if (fs.existsSync(smokeScript)) {
  console.log('\n[test] Running API Smoke Tests...');
  run(pythonBin, [smokeScript], { env: pyEnv });
}

// 3. Playwright E2E Suite if present
const playwrightDir = path.join(ROOT_DIR, 'e2e');
if (fs.existsSync(playwrightDir)) {
  console.log('\n[test] Running Playwright UI Suite...');
  run(isWin ? 'npx.cmd' : 'npx', ['playwright', 'test']);
}

console.log('\n[test] All test suites completed successfully!\n');
