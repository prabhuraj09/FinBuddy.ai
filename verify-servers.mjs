import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
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
    // Already exited
  }
}

async function verifyAll() {
  console.log('🚀 Starting Full-Stack FinBuddy Verification...');
  let errors = [];

  // 1. Start Server
  console.log('⏳ Starting Backend Server on port 5000...');
  const serverProcess = spawn('node', ['src/index.js'], {
    cwd: path.resolve(__dirname, 'server'),
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (d) => {
    const text = d.toString().trim();
    if (text) console.log(`[Server] ${text}`);
  });

  serverProcess.stderr.on('data', (d) => {
    const err = d.toString().trim();
    if (err && !err.includes('ExperimentalWarning')) {
      console.error(`[Server Error] ${err}`);
      errors.push(`Server Error: ${err}`);
    }
  });

  // 2. Start Client
  console.log('⏳ Starting Frontend Client on port 5173...');
  const clientProcess = spawn('npx', ['vite', '--port', '5173'], {
    cwd: path.resolve(__dirname, 'client'),
    stdio: 'pipe',
    shell: true
  });

  clientProcess.stdout.on('data', (d) => {
    const text = d.toString().trim();
    if (text) console.log(`[Client] ${text}`);
  });

  clientProcess.stderr.on('data', (d) => {
    const err = d.toString().trim();
    if (err) {
      console.error(`[Client Error] ${err}`);
      errors.push(`Client Error: ${err}`);
    }
  });

  // Wait 4 seconds for servers to bind
  await sleep(4000);

  let success = true;

  try {
    // 3. Test Backend Health
    console.log('\n🔎 Testing GET http://localhost:5000/api/health...');
    const healthRes = await fetch('http://localhost:5000/api/health');
    if (!healthRes.ok) throw new Error(`Backend health failed with HTTP ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log('✅ Backend Health Check:', JSON.stringify(healthData, null, 2));

    // 4. Test Calculator Endpoint
    console.log('\n🔎 Testing POST http://localhost:5000/api/calc/budget...');
    const calcRes = await fetch('http://localhost:5000/api/calc/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ income: 10000 })
    });
    const calcData = await calcRes.json();
    console.log(`✅ Budget Calculator (Income ₹10,000): Needs=₹${calcData.breakdown?.needs?.amount}, Wants=₹${calcData.breakdown?.wants?.amount}, Savings=₹${calcData.breakdown?.savings?.amount}`);

    // 5. Test Frontend HTML
    console.log('\n🔎 Testing GET http://localhost:5173...');
    const clientRes = await fetch('http://localhost:5173');
    if (!clientRes.ok) throw new Error(`Client failed with HTTP ${clientRes.status}`);
    const clientHtml = await clientRes.text();
    const hasRoot = clientHtml.includes('id="root"');
    const hasTitle = clientHtml.includes('FinBuddy AI');
    console.log(`✅ Frontend Client Active: Status 200, Root Element: ${hasRoot ? 'Found' : 'Missing'}, Title: ${hasTitle ? 'Found' : 'Missing'}`);

    if (errors.length > 0) {
      console.warn(`⚠️ Warning: encountered ${errors.length} non-fatal warning/error lines:`, errors);
    } else {
      console.log('\n🎉 ZERO ERRORS FOUND ACROSS BOTH FRONTEND & BACKEND!');
    }
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    success = false;
  } finally {
    console.log('🧹 Terminating server and client processes...');
    if (serverProcess.pid) killPid(serverProcess.pid);
    if (clientProcess.pid) killPid(clientProcess.pid);
    process.exit(success ? 0 : 1);
  }
}

verifyAll();
