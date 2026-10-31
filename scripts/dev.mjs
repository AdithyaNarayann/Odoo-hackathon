#!/usr/bin/env node

/**
 * Cross-platform dev runner for Brightloop Subscription Management System.
 * Starts backend (uvicorn, port 8000) and frontend (Vite, port 5173) with prefixed logs.
 * Checks for busy ports upfront and gracefully terminates both processes on exit.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

function pipePrefixed(stream, prefix, colorCode = '34') {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    console.log(`\x1b[${colorCode}m[${prefix}]\x1b[0m ${line}`);
  });
}

async function start() {
  console.log('\n======================================================');
  console.log('   Brightloop Subscription Management System: DEV     ');
  console.log('======================================================\n');

  // 1. Port Availability Checks
  const backendFree = await isPortAvailable(BACKEND_PORT);
  if (!backendFree) {
    console.error(
      `\x1b[31m[dev] Error: Port ${BACKEND_PORT} is already in use by another process.\x1b[0m`
    );
    console.error(`[dev] Please terminate the existing process on port ${BACKEND_PORT} and restart.\n`);
    process.exit(1);
  }

  const frontendFree = await isPortAvailable(FRONTEND_PORT);
  if (!frontendFree) {
    console.error(
      `\x1b[31m[dev] Error: Port ${FRONTEND_PORT} is already in use by another process.\x1b[0m`
    );
    console.error(`[dev] Please terminate the existing process on port ${FRONTEND_PORT} and restart.\n`);
    process.exit(1);
  }

  // 2. Locate Python binary
  const isWin = process.platform === 'win32';
  const venvDir = path.join(ROOT_DIR, 'venv');
  let pythonBin = isWin
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

  if (!fs.existsSync(pythonBin)) {
    pythonBin = isWin ? 'python' : 'python3';
  }

  console.log(`[dev] Using Python: ${pythonBin}`);
  console.log(`[dev] Starting Backend on http://localhost:${BACKEND_PORT}`);
  console.log(`[dev] Starting Frontend on http://localhost:${FRONTEND_PORT}\n`);

  const pyEnv = {
    ...process.env,
    PYTHONPATH: path.join(ROOT_DIR, 'backend'),
  };

  // 3. Spawn Backend
  const backendProc = spawn(
    pythonBin,
    ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--reload', '--port', String(BACKEND_PORT)],
    {
      cwd: ROOT_DIR,
      env: pyEnv,
      shell: false,
    }
  );

  pipePrefixed(backendProc.stdout, 'backend', '34'); // Blue
  pipePrefixed(backendProc.stderr, 'backend', '34');

  // 4. Spawn Frontend
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const frontendProc = spawn(
    npmCmd,
    ['--prefix', 'frontend', 'run', 'dev', '--', '--port', String(FRONTEND_PORT), '--strictPort'],
    {
      cwd: ROOT_DIR,
      shell: isWin,
    }
  );

  pipePrefixed(frontendProc.stdout, 'frontend', '32'); // Green
  pipePrefixed(frontendProc.stderr, 'frontend', '32');

  // 5. Clean Termination Handler
  let isShuttingDown = false;
  function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[dev] Received ${signal || 'exit'}, stopping servers...`);

    if (isWin) {
      if (backendProc.pid) {
        spawn('taskkill', ['/pid', String(backendProc.pid), '/T', '/F']);
      }
      if (frontendProc.pid) {
        spawn('taskkill', ['/pid', String(frontendProc.pid), '/T', '/F']);
      }
    } else {
      backendProc.kill('SIGTERM');
      frontendProc.kill('SIGTERM');
    }

    setTimeout(() => {
      process.exit(0);
    }, 500);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  backendProc.on('exit', (code) => {
    if (!isShuttingDown) {
      console.log(`\x1b[31m[backend] Exited with code ${code}\x1b[0m`);
      shutdown('backend_exit');
    }
  });

  frontendProc.on('exit', (code) => {
    if (!isShuttingDown) {
      console.log(`\x1b[31m[frontend] Exited with code ${code}\x1b[0m`);
      shutdown('frontend_exit');
    }
  });
}

start().catch((err) => {
  console.error('[dev] Unexpected startup error:', err);
  process.exit(1);
});
