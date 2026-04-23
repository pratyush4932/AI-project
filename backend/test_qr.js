import axios from "axios";
import fs from "fs";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:6363";
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

/**
 * Patient Sign-in/Sign-up Logic
 */
const authenticatePatient = async () => {
  separator();
  log('🔐 PATIENT AUTHENTICATION', 'blue');
  separator();

  const phone = await question('\n📱 Enter patient phone (e.g., +919876543210): ');
  
  try {
    let isSignin = false;
    log('\n📨 Sending OTP...', 'yellow');
    
    try {
      // Try signup first (simpler flow in this test)
      await axios.post(`${API_BASE_URL}/auth/signup/send-otp`, {
        phone,
        firstName: "Test",
        lastName: "User"
      });
      log('✅ OTP sent for signup!', 'green');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        log('ℹ️ User already exists. Switching to sign in...', 'cyan');
        isSignin = true;
        await axios.post(`${API_BASE_URL}/auth/signin/send-otp`, { phone });
        log('✅ OTP sent for signin!', 'green');
      } else {
        throw err;
      }
    }

    const otp = await question('🔐 Enter OTP (default: 000000): ') || '000000';

    log('\n🔍 Verifying OTP...', 'yellow');
    let response;
    if (isSignin) {
      response = await axios.post(`${API_BASE_URL}/auth/signin/verify-otp`, { phone, otp });
    } else {
      response = await axios.post(`${API_BASE_URL}/auth/signup/verify-otp`, {
        phone,
        firstName: "Test",
        lastName: "User",
        otp
      });
    }

    patientToken = response.data.token;
    patientUser = response.data.user;

    log(`✅ Patient authenticated! ID: ${patientUser.id}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Auth failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
};

/**
 * Fetch records and generate QR
 */
const testQRFlow = async () => {
  if (!patientToken) return;

  separator();
  log('🔗 QR CODE GENERATION FLOW', 'blue');
  separator();

  try {
    // 1. Fetch patient records to find something to share
    log('\n📊 Fetching your records...', 'yellow');
    const recordsRes = await axios.get(`${API_BASE_URL}/records/user/${patientUser.id}`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });

    const folders = recordsRes.data.records_view.folders || [];
    const hospitalView = recordsRes.data.hospital_view || [];
    
    let allRecords = [];
    folders.forEach(f => allRecords.push(...f.records));
    hospitalView.forEach(h => h.visits.forEach(v => allRecords.push(...v.records)));

    if (allRecords.length === 0) {
      log('❌ No records found for this patient. Please upload a record first.', 'red');
      log('💡 Tip: Run test.js or use the app to upload a record.', 'yellow');
      return;
    }

    log(`✅ Found ${allRecords.length} records.`, 'green');
    
    // Display records
    allRecords.forEach((rec, idx) => {
      log(`   [${idx}] ID: ${rec.id} (${rec.file_type}) - Source: ${rec.source || 'N/A'}`, 'cyan');
    });

    const choice = await question('\n👉 Enter record index to share (or "all"): ');
    let recordIdsToShare = [];

    if (choice.toLowerCase() === 'all') {
      recordIdsToShare = allRecords.map(r => r.id);
    } else {
      const idx = parseInt(choice, 10);
      if (isNaN(idx) || idx < 0 || idx >= allRecords.length) {
        log('❌ Invalid selection.', 'red');
        return;
      }
      recordIdsToShare = [allRecords[idx].id];
    }

    // 2. Generate QR Token
    log(`\n🎟️ Generating QR token for ${recordIdsToShare.length} record(s)...`, 'yellow');
    const qrRes = await axios.post(`${API_BASE_URL}/qr/generate`, {
      record_ids: recordIdsToShare,
      expires_in: 3600 // 1 hour
    }, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });

    const { token, expires_at } = qrRes.data;
    log('✅ QR Token generated successfully!', 'green');
    log(`   Token: ${token}`, 'green');
    log(`   Expires At: ${expires_at}`, 'green');
    log(`   Access URL: ${API_BASE_URL}/qr/${token}`, 'cyan');

    // 3. Test Access (Public Endpoint)
    separator();
    log('🕵️ TESTING PUBLIC ACCESS VIA TOKEN', 'blue');
    separator();
    
    log(`\n🌐 Fetching records using token...`, 'yellow');
    const accessRes = await axios.get(`${API_BASE_URL}/qr/${token}`);
    
    log('✅ Access successful!', 'green');
    log(`   Patient Name: ${accessRes.data.patient.name}`, 'green');
    log(`   Records Retrieved: ${accessRes.data.records.length}`, 'green');
    
    accessRes.data.records.forEach((rec, idx) => {
      log(`\n   Record ${idx + 1}:`, 'cyan');
      log(`      ID: ${rec.id}`, 'cyan');
      log(`      Signed URL: ${rec.file_url.substring(0, 50)}...`, 'cyan');
      if (rec.ai_summary) {
        log(`      AI Summary: Found`, 'green');
      }
    });

    separator();
    log('🎉 QR FLOW TEST COMPLETED SUCCESSFULLY', 'green');
    separator();

  } catch (error) {
    log(`❌ QR Flow failed: ${error.response?.data?.error || error.message}`, 'red');
    if (error.response?.data?.details) console.log(error.response.data.details);
  }
};

const main = async () => {
  log('\n', 'cyan');
  separator();
  log('🧪 MEDORA QR ACCESS TEST SUITE', 'cyan');
  separator();

  if (await authenticatePatient()) {
    await testQRFlow();
  }

  rl.close();
};

main().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  rl.close();
});
