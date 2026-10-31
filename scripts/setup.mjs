#!/usr/bin/env node

/**
 * Cross-platform setup script for Brightloop Subscription Management System.
 * Works natively on Windows, macOS, and Linux with no shell chaining.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

console.log('\n======================================================');
console.log('   Brightloop Subscription Management System: SETUP   ');
console.log('======================================================\n');

function run(cmd, args, options = {}) {
  const displayCmd = `"${cmd}" ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`;
  console.log(`[setup] > ${displayCmd}`);
  
  // On Windows, if running a batch file like npm.cmd, shell may be needed.
  // When shell is true and path contains spaces, cmd needs to be properly quoted.
  const isCmdBatch = isWin && (cmd.endsWith('.cmd') || cmd.endsWith('.bat'));
  const useShell = isCmdBatch;

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    shell: useShell,
    windowsHide: true,
    ...options,
  });

  if (result.error) {
    console.error(`[setup] Failed to execute ${cmd}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[setup] Command exited with code ${result.status}: ${displayCmd}`);
    process.exit(result.status || 1);
  }
  return result;
}

// 1. Determine Python and Virtualenv paths
const venvDir = path.join(ROOT_DIR, 'venv');
let pythonBin = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

if (!fs.existsSync(pythonBin)) {
  console.log('[setup] Creating Python virtual environment (venv)...');
  const hostPython = isWin ? 'python' : 'python3';
  run(hostPython, ['-m', 'venv', 'venv']);
} else {
  console.log('[setup] Existing virtual environment found at venv');
}

// Ensure python binary exists after creation
if (!fs.existsSync(pythonBin)) {
  console.log('[setup] Virtualenv python not found, falling back to system python...');
  pythonBin = isWin ? 'python' : 'python3';
}

// 2. Install backend dependencies
console.log('\n[setup] Installing backend dependencies from backend/requirements.txt...');
run(pythonBin, ['-m', 'pip', 'install', '-r', 'backend/requirements.txt']);

// 3. Install frontend and root dependencies
console.log('\n[setup] Installing root dependencies...');
run(isWin ? 'npm.cmd' : 'npm', ['install']);

console.log('\n[setup] Installing frontend dependencies...');
run(isWin ? 'npm.cmd' : 'npm', ['--prefix', 'frontend', 'install']);

// 4. Ensure environment files (.env) exist from examples
console.log('\n[setup] Verifying environment configuration files...');

function copyIfMissing(src, dest) {
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`[setup] Created ${path.relative(ROOT_DIR, dest)} from ${path.relative(ROOT_DIR, src)}`);
  } else if (fs.existsSync(dest)) {
    console.log(`[setup] Configuration exists at ${path.relative(ROOT_DIR, dest)}`);
  }
}

copyIfMissing(path.join(ROOT_DIR, '.env.example'), path.join(ROOT_DIR, '.env'));
copyIfMissing(
  path.join(ROOT_DIR, 'backend', '.env.example'),
  path.join(ROOT_DIR, 'backend', '.env')
);
copyIfMissing(
  path.join(ROOT_DIR, 'frontend', '.env.example'),
  path.join(ROOT_DIR, 'frontend', '.env')
);

// 5. Run database migrations
console.log('\n[setup] Running Alembic database migrations...');
const pyEnv = {
  ...process.env,
  PYTHONPATH: path.join(ROOT_DIR, 'backend'),
};
run(pythonBin, ['-m', 'alembic', 'upgrade', 'head'], { env: pyEnv });

// 6. Seed sample dataset and default accounts
const shouldReset = process.argv.includes('--reset');
const targetSize = process.argv.includes('--full') ? 5000 : 200;
console.log(`\n[setup] Seeding database (size: ${targetSize}, reset: ${shouldReset})...`);
const seedArgs = ['-m', 'app.seed', String(targetSize)];
if (shouldReset) {
  seedArgs.push('--reset');
}
run(pythonBin, seedArgs, { env: pyEnv });

console.log('\n======================================================');
console.log('   [SUCCESS] Brightloop Setup Completed Successfully! ');
console.log('======================================================');
console.log('\nDefault Accounts:');
console.log('  - Admin:    admin@brightloop.com    / Admin@1234');
console.log('  - Staff:    staff@brightloop.com    / Staff@1234');
console.log('  - Customer: customer@brightloop.com / Customer@1234');
console.log('\nStart the full stack application with:');
console.log('  npm run dev\n');
