import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch (e) {
    // Process exited
  }
}

async function capture() {
  console.log('📸 Starting FinBuddy AI Multi-View Screenshot Capture Process...');

  const screenshotsDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Start Server
  console.log('⏳ Starting Backend Server...');
  const serverProcess = spawn('node', ['src/index.js'], {
    cwd: path.resolve(__dirname, 'server'),
    stdio: 'pipe'
  });

  // 2. Start Client
  console.log('⏳ Starting Frontend Client...');
  const clientProcess = spawn('npx', ['vite', '--port', '5173'], {
    cwd: path.resolve(__dirname, 'client'),
    stdio: 'pipe',
    shell: true
  });

  await sleep(4000);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    console.error('Edge executable not found at:', edgePath);
    killPid(serverProcess.pid);
    killPid(clientProcess.pid);
    return;
  }

  function runCapture(url, outputPath, width, height) {
    try {
      execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${outputPath}" --window-size=${width},${height} "${url}"`, { stdio: 'ignore' });
      if (fs.existsSync(outputPath)) {
        console.log(`✅ Saved: ${path.basename(outputPath)} (${fs.statSync(outputPath).size} bytes)`);
      }
    } catch (e) {
      if (fs.existsSync(outputPath)) {
        console.log(`✅ Saved: ${path.basename(outputPath)} (${fs.statSync(outputPath).size} bytes)`);
      } else {
        console.error(`❌ Failed: ${path.basename(outputPath)}:`, e.message);
      }
    }
  }

  try {
    // 1. Desktop Welcome Screen
    runCapture('http://localhost:5173', path.resolve(screenshotsDir, 'desktop-welcome.png'), 1440, 900);

    // 2. Mobile Welcome Screen
    runCapture('http://localhost:5173', path.resolve(screenshotsDir, 'mobile-welcome.png'), 390, 844);

    // 3. Desktop Tools Tab
    runCapture('http://localhost:5173/?view=tools', path.resolve(screenshotsDir, 'desktop-tools.png'), 1440, 900);

    // 4. Mobile Tools Tab
    runCapture('http://localhost:5173/?view=tools', path.resolve(screenshotsDir, 'mobile-tools.png'), 390, 844);

    console.log('\n🎉 ALL SCREENSHOTS SUCCESSFULLY PROCESSED!');
  } catch (err) {
    console.error('Capture pipeline error:', err.message);
  } finally {
    killPid(serverProcess.pid);
    killPid(clientProcess.pid);
  }
}

capture();
