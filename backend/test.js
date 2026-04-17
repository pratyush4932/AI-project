import axios from "axios";
import fs from "fs";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = "http://localhost:6363";
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Store tokens for each role
let tokens = {
  patient: null,
  doctor: null,
  hospital: null,
};

let userData = {
  patient: null,
  doctor: null,
  hospital: null,
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

const testResult = (testName, success, message = '') => {
  if (success) {
    log(`✅ ${testName} - PASSED`, 'green');
  } else {
    log(`❌ ${testName} - FAILED: ${message}`, 'red');
  }
};

/**
 * PHASE 1: AUTHENTICATION
 */

const patientSignup = async () => {
  separator();
  log('PHASE 1: PATIENT AUTHENTICATION', 'blue');
  separator();

  const phone = await question('\n📱 Enter patient phone (e.g., +919876543210): ');
  const firstName = await question('👤 Enter first name: ');
  const lastName = await question('👤 Enter last name: ');

  try {
    let isSignin = false;
    // Send OTP
    log('\n📨 Sending OTP...', 'yellow');
    try {
      await axios.post(`${API_BASE_URL}/auth/signup/send-otp`, {
        phone,
        firstName,
        lastName,
      });
      log('✅ OTP sent successfully for signup!', 'green');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        log('ℹ️ User already exists. Switching to sign in...', 'cyan');
        isSignin = true;
        await axios.post(`${API_BASE_URL}/auth/signin/send-otp`, { phone });
        log('✅ OTP sent successfully for signin!', 'green');
      } else {
        throw err;
      }
    }

    // Ask for OTP
    const otp = await question('🔐 Enter OTP received (default dev OTP: 000000): ');

    // Verify OTP
    log('\n🔍 Verifying OTP...', 'yellow');
    let response;

    if (isSignin) {
      response = await axios.post(`${API_BASE_URL}/auth/signin/verify-otp`, {
        phone,
        otp: otp || '000000',
      });
    } else {
      response = await axios.post(`${API_BASE_URL}/auth/signup/verify-otp`, {
        phone,
        firstName,
        lastName,
        otp: otp || '000000',
      });
    }

    tokens.patient = response.data.token;
    userData.patient = response.data.user;

    log(`✅ Patient ${isSignin ? 'signed in' : 'signed up'} successfully!`, 'green');
    log(`   Name: ${userData.patient.name}`, 'green');
    log(`   Phone: ${userData.patient.phone}`, 'green');
    log(`   Token: ${tokens.patient.substring(0, 30)}...`, 'green');
    return true;
  } catch (error) {
    log(`❌ Patient authentication failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
};

const hospitalSignup = async () => {
  separator();
  log('PHASE 1: HOSPITAL AUTHENTICATION', 'blue');
  separator();

  const phone = await question('\n🏥 Enter hospital phone (e.g., +919876543210): ');
  const name = await question('🏥 Enter hospital name (e.g., Apollo Hospital): ');
  const address = await question('📍 Enter hospital address (optional): ');

  try {
    // Send OTP
    log('\n📨 Sending OTP...', 'yellow');
    let response = await axios.post(`${API_BASE_URL}/hospital/send-otp`, {
      phone,
    });
    log('✅ OTP sent successfully!', 'green');

    // Ask for OTP
    const otp = await question('🔐 Enter OTP received (default dev OTP: 000000): ');

    // Verify OTP
    log('\n🔍 Verifying OTP...', 'yellow');
    response = await axios.post(`${API_BASE_URL}/hospital/verify-otp`, {
      phone,
      name,
      address,
      otp: otp || '000000',
    });

    tokens.hospital = response.data.token;
    userData.hospital = response.data.hospital;

    log(`✅ Hospital registered successfully!`, 'green');
    log(`   Name: ${userData.hospital.name}`, 'green');
    log(`   Phone: ${userData.hospital.phone}`, 'green');
    log(`   Token: ${tokens.hospital.substring(0, 30)}...`, 'green');
    return true;
  } catch (error) {
    log(`❌ Hospital signup failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
};

const hospitalAddDoctor = async () => {
  separator();
  log('PHASE 3: HOSPITAL - ADD DOCTOR', 'blue');
  separator();

  if (!tokens.hospital) {
    log('❌ Hospital not authenticated. Please authenticate hospital first.', 'red');
    return false;
  }

  const name = await question('\n👨‍⚕️ Enter doctor name: ');
  const phone = await question('📱 Enter doctor phone (e.g., +919876543211): ');
  const specialization = await question('🔬 Enter specialization (e.g., Cardiology): ');

  try {
    log('\n👨‍⚕️ Adding doctor to hospital...', 'yellow');
    const response = await axios.post(`${API_BASE_URL}/hospital/doctors/add`,
      {
        name,
        phone,
        specialization,
        license_no: 'DOC12345',
      },
      {
        headers: { Authorization: `Bearer ${tokens.hospital}` },
      }
    );

    log(`✅ Doctor added to hospital successfully!`, 'green');
    log(`   Name: ${response.data.doctor.name}`, 'green');
    log(`   Phone: ${response.data.doctor.phone}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Add doctor failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
};

const doctorLogin = async () => {
  separator();
  log('PHASE 1: DOCTOR LOGIN', 'blue');
  separator();

  const doctorPhone = await question('\n📱 Enter existng doctor phone for OTP login: ');

  try {
    log('\n📨 Sending OTP...', 'yellow');
    let otpResponse = await axios.post(`${API_BASE_URL}/doctor/signin/send-otp`, {
      phone: doctorPhone,
    });
    log('✅ OTP sent to doctor!', 'green');

    const otp = await question('🔐 Enter OTP (default dev OTP: 000000): ');

    log('\n🔍 Verifying OTP...', 'yellow');
    otpResponse = await axios.post(`${API_BASE_URL}/doctor/signin/verify-otp`, {
      phone: doctorPhone,
      otp: otp || '000000',
    });

    tokens.doctor = otpResponse.data.token;
    userData.doctor = otpResponse.data.doctor;

    log(`✅ Doctor logged in successfully!`, 'green');
    log(`   Name: ${userData.doctor.name}`, 'green');
    log(`   Hospital: ${userData.doctor.hospital_name || 'N/A'}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Doctor login failed: ${error.response?.data?.error || error.message}`, 'red');
    return false;
  }
};

/**
 * PHASE 2: PATIENT ENDPOINTS
 */

const testPatientFolders = async () => {
  separator();
  log('PHASE 2: PATIENT - FOLDER MANAGEMENT', 'blue');
  separator();

  if (!tokens.patient) {
    log('❌ Patient not authenticated', 'red');
    return {};
  }

  const folderData = {};

  try {
    // Create folder
    log('\n📁 Creating folder...', 'yellow');
    let response = await axios.post(`${API_BASE_URL}/folders/create`,
      { name: 'Medical Records' },
      { headers: { Authorization: `Bearer ${tokens.patient}` } }
    );
    folderData.folderId = response.data.folder.id;
    testResult('Create Folder', true);
    log(`   Folder ID: ${folderData.folderId}`, 'green');

    // Get folders
    log('\n📂 Fetching all folders...', 'yellow');
    response = await axios.get(`${API_BASE_URL}/folders`,
      { headers: { Authorization: `Bearer ${tokens.patient}` } }
    );
    testResult('Get Folders', true);
    log(`   Total folders: ${response.data.folders.length}`, 'green');

    return folderData;
  } catch (error) {
    testResult('Folder Operations', false, error.response?.data?.error || error.message);
    return {};
  }
};

const testPatientRecords = async (folderData) => {
  separator();
  log('PHASE 2: PATIENT - RECORD UPLOAD & MANAGEMENT', 'blue');
  separator();

  if (!tokens.patient) {
    log('❌ Patient not authenticated', 'red');
    return {};
  }

  const recordData = {};

  try {
    // Upload record to folder
    log('\n📄 Uploading record to folder...', 'yellow');
    const fileStream = fs.createReadStream(path.join(__dirname, 'test2.pdf'));

    const formData = new FormData();
    formData.append('file', fileStream);
    formData.append('folder_id', folderData.folderId || '');

    let response = await axios.post(`${API_BASE_URL}/records/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${tokens.patient}`
        }
      }
    );
    recordData.recordId = response.data.record.id;
    testResult('Upload Record', true);
    log(`   Record ID: ${recordData.recordId}`, 'green');

    // Get records by user ID
    log('\n📊 Fetching records by user ID...', 'yellow');
    response = await axios.get(`${API_BASE_URL}/records/user/${userData.patient.id}`,
      { headers: { Authorization: `Bearer ${tokens.patient}` } }
    );
    testResult('Get Records by User ID', true);
    log(`   Total records: ${response.data.records_view.folders.reduce((acc, f) => acc + f.records.length, 0)}`, 'green');

    // // Delete record
    // if (recordData.recordId) {
    //   log('\n🗑️ Deleting record...', 'yellow');
    //   response = await axios.delete(`${API_BASE_URL}/records/${recordData.recordId}`,
    //     { headers: { Authorization: `Bearer ${tokens.patient}` } }
    //   );
    //   testResult('Delete Record', true);
    // }

    return recordData;
  } catch (error) {
    testResult('Record Operations', false, error.response?.data?.error || error.message);
    return {};
  }
};

/**
 * PHASE 3: HOSPITAL ENDPOINTS
 */

const testHospitalPatients = async () => {
  separator();
  log('PHASE 3: HOSPITAL - PATIENT MANAGEMENT', 'blue');
  separator();

  if (!tokens.hospital) {
    log('❌ Hospital not authenticated', 'red');
    return {};
  }

  const hospitalData = {};

  try {
    // Add patient to hospital
    log('\n👥 Adding patient to hospital...', 'yellow');
    const patientPhone = await question('📱 Enter patient phone to add: ');

    let response = await axios.post(`${API_BASE_URL}/hospital/patients/add`,
      { phone: patientPhone },
      { headers: { Authorization: `Bearer ${tokens.hospital}` } }
    );
    hospitalData.patientId = response.data.patient.id;
    testResult('Add Patient to Hospital', true);
    log(`   Patient: ${response.data.patient.name}`, 'green');

    // Get hospital patients
    log('\n👥 Fetching hospital patients...', 'yellow');
    response = await axios.get(`${API_BASE_URL}/hospital/patients`,
      { headers: { Authorization: `Bearer ${tokens.hospital}` } }
    );
    testResult('Get Hospital Patients', true);
    log(`   Total patients: ${response.data.total}`, 'green');

    return hospitalData;
  } catch (error) {
    testResult('Hospital Patient Operations', false, error.response?.data?.error || error.message);
    return {};
  }
};

const testHospitalDoctors = async () => {
  separator();
  log('PHASE 3: HOSPITAL - DOCTOR MANAGEMENT', 'blue');
  separator();

  if (!tokens.hospital) {
    log('❌ Hospital not authenticated', 'red');
    return;
  }

  try {
    // Get hospital doctors
    log('\n👨‍⚕️ Fetching hospital doctors...', 'yellow');
    const response = await axios.get(`${API_BASE_URL}/hospital/doctors`,
      { headers: { Authorization: `Bearer ${tokens.hospital}` } }
    );
    testResult('Get Hospital Doctors', true);
    log(`   Total doctors: ${response.data.total}`, 'green');

    if (response.data.doctors.length > 0) {
      log(`   Sample doctor: ${response.data.doctors[0].name}`, 'green');
    }
  } catch (error) {
    testResult('Hospital Doctor Operations', false, error.response?.data?.error || error.message);
  }
};

const testHospitalRecords = async (hospitalData) => {
  separator();
  log('PHASE 3: HOSPITAL - RECORD UPLOAD & MANAGEMENT', 'blue');
  separator();

  if (!tokens.hospital || !hospitalData.patientId) {
    log('❌ Hospital not authenticated or no patient added', 'red');
    return {};
  }

  try {
    // Get patient to retrieve phone
    const patients = await axios.get(`${API_BASE_URL}/hospital/patients`,
      { headers: { Authorization: `Bearer ${tokens.hospital}` } }
    );
    const patient = patients.data.patients[0];

    if (!patient) {
      log('❌ No patient found in hospital', 'red');
      return {};
    }

    // Upload patient record
    log('\n📄 Uploading hospital patient record...', 'yellow');
    const fileStream = fs.createReadStream(path.join(__dirname, 'test.pdf'));

    const formData = new FormData();
    formData.append('file', fileStream);

    const response = await axios.post(`${API_BASE_URL}/hospital/patients/${patient.phone}/records`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${tokens.hospital}`
        }
      }
    );
    testResult('Upload Hospital Record', true);
    log(`   Record uploaded for: ${response.data.patient_name}`, 'green');

    // Get hospital info
    log('\n🏥 Fetching hospital full info...', 'yellow');
    const infoResponse = await axios.get(`${API_BASE_URL}/hospital/info`,
      { headers: { Authorization: `Bearer ${tokens.hospital}` } }
    );
    testResult('Get Hospital Info', true);
    log(`   Hospital: ${infoResponse.data.hospital.name}`, 'green');
    log(`   Staff: ${infoResponse.data.staff.length}`, 'green');

    // // Delete patient documents
    // log('\n🗑️ Deleting patient documents...', 'yellow');
    // const deleteResponse = await axios.delete(`${API_BASE_URL}/hospital/patients/${hospitalData.patientId}/documents`,
    //   { headers: { Authorization: `Bearer ${tokens.hospital}` } }
    // );
    // testResult('Delete Patient Documents', true);

    return { patientId: hospitalData.patientId };
  } catch (error) {
    testResult('Hospital Record Operations', false, error.response?.data?.error || error.message);
    return {};
  }
};

/**
 * PHASE 4: DOCTOR ENDPOINTS
 */

const testDoctorProfile = async () => {
  separator();
  log('PHASE 4: DOCTOR - PROFILE', 'blue');
  separator();

  if (!tokens.doctor) {
    log('❌ Doctor not authenticated', 'red');
    return;
  }

  try {
    log('\n👨‍⚕️ Fetching doctor profile...', 'yellow');
    const response = await axios.get(`${API_BASE_URL}/doctor/profile`,
      { headers: { Authorization: `Bearer ${tokens.doctor}` } }
    );
    testResult('Get Doctor Profile', true);
    log(`   Doctor: ${response.data.doctor.name}`, 'green');
    log(`   Hospital: ${response.data.doctor.hospital_name}`, 'green');
  } catch (error) {
    testResult('Get Doctor Profile', false, error.response?.data?.error || error.message);
  }
};

/**
 * PHASE 5: SIGNOUT ENDPOINTS
 */

const testSignouts = async () => {
  separator();
  log('PHASE 5: SIGNOUT ENDPOINTS', 'blue');
  separator();

  try {
    if (tokens.patient) {
      log('\n👤 Patient signout...', 'yellow');
      await axios.post(`${API_BASE_URL}/auth/signout`,
        {},
        { headers: { Authorization: `Bearer ${tokens.patient}` } }
      );
      testResult('Patient Signout', true);
    }

    if (tokens.doctor) {
      log('\n👨‍⚕️ Doctor signout...', 'yellow');
      await axios.post(`${API_BASE_URL}/doctor/signout`,
        {},
        { headers: { Authorization: `Bearer ${tokens.doctor}` } }
      );
      testResult('Doctor Signout', true);
    }

    if (tokens.hospital) {
      log('\n🏥 Hospital signout...', 'yellow');
      await axios.post(`${API_BASE_URL}/hospital/signout`,
        {},
        { headers: { Authorization: `Bearer ${tokens.hospital}` } }
      );
      testResult('Hospital Signout', true);
    }
  } catch (error) {
    log(`❌ Signout error: ${error.response?.data?.error || error.message}`, 'red');
  }
};

/**
 * MAIN TEST RUNNER
 */

const runTests = async () => {
  log('\n', 'cyan');
  separator();
  log('🧪 COMPREHENSIVE API TEST SUITE', 'cyan');
  log('Testing all endpoints except AI', 'cyan');
  separator();

  const menu = `
${colors.yellow}Choose test scenario:${colors.reset}
1. Patient Flow (Sign up, create folders, upload records)
2. Hospital Flow (Register, add patients, add doctors, upload records)
3. Doctor Flow (Login, view profile)
4. Complete Flow (All 3 roles with interactions)
5. Exit

`;

  console.log(menu);
  const choice = await question('Enter choice (1-5): ');

  switch (choice) {
    case '1':
      if (await patientSignup()) {
        const folderData = await testPatientFolders();
        await testPatientRecords(folderData);
        await testSignouts();
      }
      break;

    case '2':
      if (await hospitalSignup()) {
        const hospitalData = await testHospitalPatients();
        await hospitalAddDoctor();
        await testHospitalDoctors();
        await testHospitalRecords(hospitalData);
        await testSignouts();
      }
      break;

    case '3':
      if (await doctorLogin()) {
        await testDoctorProfile();
        await testSignouts();
      }
      break;

    case '4':
      if (await patientSignup()) {
        if (await hospitalSignup()) {
          const folderData = await testPatientFolders();
          await testPatientRecords(folderData);
          const hospitalData = await testHospitalPatients();
          await hospitalAddDoctor();
          await testHospitalDoctors();
          await testHospitalRecords(hospitalData);
          if (await doctorLogin()) {
            await testDoctorProfile();
            await testSignouts();
          }
        }
      }
      break;

    case '5':
      log('\n👋 Exiting test suite', 'yellow');
      break;

    default:
      log('\n❌ Invalid choice', 'red');
  }

  rl.close();
};

// Start tests
runTests().catch((error) => {
  log(`\n❌ Test suite error: ${error.message}`, 'red');
  rl.close();
});
