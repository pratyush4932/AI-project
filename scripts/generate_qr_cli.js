import axios from "axios";
import readline from "readline";
import qrcode from "qrcode-terminal";
import 'dotenv/config';

const API_BASE_URL = process.env.PUBLIC_URL || "http://localhost:6363";
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const separator = () => {
  log('═'.repeat(80), 'cyan');
};

let patientToken = null;
let patientUser = null;

async function authenticate() {
  separator();
  log('🔐 PATIENT AUTHENTICATION', 'blue');
  separator();

  const phone = await question('\n📱 Enter patient phone (e.g., +919876543210): ');
  
  try {
    log('📨 Sending OTP...', 'yellow');
    try {
      await axios.post(`${API_BASE_URL}/auth/signup/send-otp`, {
        phone,
        firstName: "Test",
        lastName: "User"
      });
    } catch (err) {
      if (err.response?.status === 409) {
        await axios.post(`${API_BASE_URL}/auth/signin/send-otp`, { phone });
      } else throw err;
    }

    const otp = await question('🔐 Enter OTP (default: 000000): ') || '000000';
    
    const response = await axios.post(`${API_BASE_URL}/auth/signin/verify-otp`, { phone, otp });
    patientToken = response.data.token;
    patientUser = response.data.user;

    log(`✅ Authenticated as ${patientUser.name}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Auth failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
}

async function generateQR() {
  separator();
  log('📊 RECORD SELECTION', 'blue');
  separator();

  try {
    const res = await axios.get(`${API_BASE_URL}/records/user/${patientUser.id}`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });

    const folders = res.data.records_view.folders || [];
    const hospitals = res.data.hospital_view || [];

    log('\nOptions:', 'yellow');
    log('1. All Records (Everything)');
    log('2. Only Hospital Records (Verified by Registered Hospitals)');
    log('3. Only Personal Folders');
    
    const hospitalMap = {};
    hospitals.forEach((h, i) => {
      hospitalMap[i + 4] = h;
      log(`${i + 4}. Hospital: ${h.hospital_name} (${h.visits.length} visits)`);
    });

    const choice = await question('\n👉 Select option (number): ');
    let selectedRecords = [];

    if (choice === '1') {
      // Everything
      folders.forEach(f => selectedRecords.push(...f.records.map(r => r.id)));
      hospitals.forEach(h => h.visits.forEach(v => selectedRecords.push(...v.records.map(r => r.id))));
    } else if (choice === '2') {
      // Only Hospital Records
      hospitals.forEach(h => h.visits.forEach(v => selectedRecords.push(...v.records.map(r => r.id))));
    } else if (choice === '3') {
      // Only Personal Folders
      folders.forEach(f => selectedRecords.push(...f.records.map(r => r.id)));
    } else {
      // Specific Hospital
      const hospital = hospitalMap[choice];
      if (!hospital) {
        log('❌ Invalid selection', 'red');
        return;
      }
      hospital.visits.forEach(v => selectedRecords.push(...v.records.map(r => r.id)));
    }

    if (selectedRecords.length === 0) {
      log('❌ No records found for this selection.', 'red');
      return;
    }

    log(`\n🎟️ Generating QR for ${selectedRecords.length} records...`, 'yellow');
    const qrRes = await axios.post(`${API_BASE_URL}/qr/generate`, {
      record_ids: selectedRecords,
      expires_in: 3600
    }, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });

    const { token } = qrRes.data;
    const publicUrl = await question(`\n🌐 Enter public Base URL (e.g. ngrok) or leave blank for ${API_BASE_URL}: `);
    const finalBaseUrl = publicUrl || API_BASE_URL;
    const accessUrl = `${finalBaseUrl}/qr/${token}`;

    separator();
    log('📱 SCAN THIS QR CODE WITH THE DOCTOR APP', 'green');
    separator();
    
    qrcode.generate(accessUrl, { small: true });
    
    log(`\nURL: ${accessUrl}`, 'cyan');
    log(`Expires in 1 hour`, 'yellow');

  } catch (error) {
    log(`❌ Error: ${error.response?.data?.error || error.message}`, 'red');
  }
}

async function main() {
  if (await authenticate()) {
    await generateQR();
  }
  rl.close();
}

main();
