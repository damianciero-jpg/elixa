const http = require('http');
const { spawn } = require('child_process');

const port = process.env.PORT || '8081';
const baseURL = `http://127.0.0.1:${port}`;
const isUi = process.argv.includes('--ui');
let server;

function requestReady() {
  return new Promise((resolve) => {
    const req = http.get(baseURL, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    if (await requestReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Expo web server did not become ready at ${baseURL}`);
}

function startExpo() {
  server = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--web', '--port', port], {
    cwd: process.cwd(),
    detached: process.platform !== 'win32',
    env: { ...process.env, PORT: port },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function stopExpo() {
  if (!server || server.exitCode !== null) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }

  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // The server may already be gone.
  }
}

async function main() {
  const serverAlreadyRunning = await requestReady();
  if (!serverAlreadyRunning) {
    startExpo();
    await waitForServer();
  }

  const args = ['node_modules/@playwright/test/cli.js', 'test'];
  if (isUi) args.push('--ui');

  const tests = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: 'inherit',
  });

  tests.on('exit', (code) => {
    if (!serverAlreadyRunning) stopExpo();
    process.exit(code ?? 1);
  });
}

process.on('SIGINT', () => {
  stopExpo();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopExpo();
  process.exit(143);
});

main().catch((error) => {
  stopExpo();
  console.error(error);
  process.exit(1);
});
