import axios from "axios";
import fs from "fs";

const HOSPITAL_API = "http://localhost:6969/hospital";
const DOCTOR_API = "http://localhost:6969/doctor";
const AUTH_API = "http://localhost:6969/auth";

// Test credentials - OTP based
let hospitalToken = null;
let doctorToken = null;
let hospitalOTP = "000000"; // Will be updated by actual OTP in real scenario
let doctorOTP = "000000"; // Will be updated by actual OTP in real scenario

const testHospital = {
  phone: "+919876543210",
  name: "Apollo Hospital",
  address: "Mumbai, India",
  license_no: "LIC12345",
};

const testDoctor = {
  name: "Dr. Rajesh Kumar",
  phone: "+919876543211",
  specialization: "Cardiology",
  license_no: "DOC98765",
};

// Patient already exists in database (verified via OTP signup)
const testPatient = {
  name: "Pratyush Majhee",
  phone: "+918231033230",
};

/**
 * Test 1: Send OTP for Hospital
 */
const testSendHospitalOTP = async () => {
  console.log("\n🧪 TEST 1: Send OTP for Hospital");
  console.log("─".repeat(50));

  try {
    const response = await axios.post(`${HOSPITAL_API}/send-otp`, {
      phone: testHospital.phone,
    });

    console.log("✅ Success!");
    console.log(`   Message: ${response.data.message}`);
    console.log(`   📱 Check your SMS for OTP`);
    console.log(`   (In development, use OTP from Twilio console)`);

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 2: Verify OTP for Hospital Registration
 */
const testVerifyHospitalOTP = async () => {
  console.log("\n🧪 TEST 2: Verify OTP for Hospital (Registration)");
  console.log("─".repeat(50));

  try {
    const response = await axios.post(`${HOSPITAL_API}/verify-otp`, {
      phone: testHospital.phone,
      otp: hospitalOTP,
      name: testHospital.name,
      address: testHospital.address,
      license_no: testHospital.license_no,
    });

    console.log("✅ Success!");
    console.log(`   Hospital ID: ${response.data.hospital.id}`);
    console.log(`   Name: ${response.data.hospital.name}`);
    console.log(`   Phone: ${response.data.hospital.phone}`);
    console.log(`   Is New: ${response.data.hospital.is_new}`);
    console.log(`   Token: ${response.data.token.substring(0, 20)}...`);

    hospitalToken = response.data.token;
    testHospital.id = response.data.hospital.id;

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 3: Hospital Login with OTP (existing hospital)
 */
const testHospitalLoginOTP = async () => {
  console.log("\n🧪 TEST 3: Hospital Login (OTP for existing hospital)");
  console.log("─".repeat(50));

  try {
    // First send OTP
    await axios.post(`${HOSPITAL_API}/send-otp`, {
      phone: testHospital.phone,
    });

    console.log("   ✓ OTP sent");

    // Then verify it (no name needed for existing hospital)
    const response = await axios.post(`${HOSPITAL_API}/verify-otp`, {
      phone: testHospital.phone,
      otp: hospitalOTP,
    });

    console.log("✅ Success!");
    console.log(`   Hospital ID: ${response.data.hospital.id}`);
    console.log(`   Name: ${response.data.hospital.name}`);
    console.log(`   Is New: ${response.data.hospital.is_new}`);
    console.log(`   Token: ${response.data.token.substring(0, 20)}...`);

    hospitalToken = response.data.token;

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 4: Add Doctor to Hospital
 */
const testAddDoctor = async () => {
  console.log("\n🧪 TEST 4: Add Doctor to Hospital");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    const response = await axios.post(`${HOSPITAL_API}/doctors/add`, {
      name: testDoctor.name,
      phone: testDoctor.phone,
      specialization: testDoctor.specialization,
      license_no: testDoctor.license_no,
    }, {
      headers: {
        Authorization: `Bearer ${hospitalToken}`,
      },
    });

    console.log("✅ Success!");
    console.log(`   Doctor ID: ${response.data.doctor.id}`);
    console.log(`   Name: ${response.data.doctor.name}`);
    console.log(`   Phone: ${response.data.doctor.phone}`);
    console.log(`   Specialization: ${response.data.doctor.specialization}`);
    console.log(`   Hospital ID: ${response.data.doctor.hospital_id}`);
    console.log(`   📝 ${response.data.doctor.message}`);

    testDoctor.id = response.data.doctor.id;

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 5: Get Hospital Doctors
 */
const testGetHospitalDoctors = async () => {
  console.log("\n🧪 TEST 5: Get Hospital Doctors");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    const response = await axios.get(`${HOSPITAL_API}/doctors`, {
      headers: {
        Authorization: `Bearer ${hospitalToken}`,
      },
    });

    console.log("✅ Success!");
    console.log(`   Hospital ID: ${response.data.hospital_id}`);
    console.log(`   Total Doctors: ${response.data.total}`);

    if (response.data.doctors.length > 0) {
      console.log("\n   👨‍⚕️ Doctors:");
      response.data.doctors.forEach((doctor) => {
        console.log(`   - ${doctor.name}`);
        console.log(`     Phone: ${doctor.phone}`);
        console.log(`     Specialization: ${doctor.specialization}`);
        console.log(`     Status: ${doctor.status}`);
      });
    }

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 6: Send OTP for Doctor Login
 */
const testSendDoctorOTP = async () => {
  console.log("\n🧪 TEST 6: Send OTP for Doctor Login");
  console.log("─".repeat(50));

  try {
    const response = await axios.post(`${DOCTOR_API}/send-otp`, {
      phone: testDoctor.phone,
    });

    console.log("✅ Success!");
    console.log(`   Message: ${response.data.message}`);
    console.log(`   📱 Check your SMS for OTP`);

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 7: Verify OTP for Doctor Login
 */
const testVerifyDoctorOTP = async () => {
  console.log("\n🧪 TEST 7: Verify OTP for Doctor Login");
  console.log("─".repeat(50));

  try {
    const response = await axios.post(`${DOCTOR_API}/verify-otp`, {
      phone: testDoctor.phone,
      otp: doctorOTP,
    });

    console.log("✅ Success!");
    console.log(`   Doctor ID: ${response.data.doctor.id}`);
    console.log(`   Name: ${response.data.doctor.name}`);
    console.log(`   Phone: ${response.data.doctor.phone}`);
    console.log(`   Specialization: ${response.data.doctor.specialization}`);
    console.log(`   Hospital: ${response.data.doctor.hospital_name}`);
    console.log(`   Token: ${response.data.token.substring(0, 20)}...`);

    doctorToken = response.data.token;

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 8: Get Doctor Profile
 */
const testGetDoctorProfile = async () => {
  console.log("\n🧪 TEST 8: Get Doctor Profile");
  console.log("─".repeat(50));

  if (!doctorToken) {
    console.error("❌ No doctor token. Skipping test.");
    return;
  }

  try {
    const response = await axios.get(`${DOCTOR_API}/profile`, {
      headers: {
        Authorization: `Bearer ${doctorToken}`,
      },
    });

    const doctor = response.data.doctor;
    console.log("✅ Success!");
    console.log(`   Name: ${doctor.name}`);
    console.log(`   Phone: ${doctor.phone}`);
    console.log(`   Specialization: ${doctor.specialization}`);
    console.log(`   License: ${doctor.license_no}`);
    console.log(`   Hospital: ${doctor.hospital?.name}`);
    console.log(`   Status: ${doctor.status}`);

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 9: Add Existing Patient to Hospital
 */
const testAddExistingPatientToHospital = async () => {
  console.log("\n🧪 TEST 9: Add Existing Patient to Hospital");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    const response = await axios.post(`${HOSPITAL_API}/patients/add`, {
      phone: testPatient.phone,  // Only phone required - name fetched from users table
    }, {
      headers: {
        Authorization: `Bearer ${hospitalToken}`,
      },
    });

    console.log("✅ Success!");
    console.log(`   Patient ID: ${response.data.patient.id}`);
    console.log(`   Name: ${response.data.patient.name}`);
    console.log(`   Phone: ${response.data.patient.phone}`);
    console.log(`   Message: ${response.data.message}`);

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 10: Try Add Non-Existent Patient (Should Fail)
 */
const testAddNonExistentPatientWithoutName = async () => {
  console.log("\n🧪 TEST 10: Add Non-Existent Patient (Should Fail)");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    const response = await axios.post(`${HOSPITAL_API}/patients/add`, {
      phone: "+919999999999", // Non-existent patient
      // Only phone - no other data
    }, {
      headers: {
        Authorization: `Bearer ${hospitalToken}`,
      },
    });

    console.log("❌ Unexpected success - should have failed");

  } catch (error) {
    if (error.response?.status === 404) {
      console.log("✅ Correctly rejected!");
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error}`);
      console.log(`   Action: ${error.response.data.action}`);
    } else {
      console.error("❌ Wrong error:");
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Error: ${JSON.stringify(error.response.data)}`);
      } else {
        console.error(`   Error: ${error.message}`);
      }
    }
  }
};

/**
 * Test 11: Get All Hospital Patients
 */
const testGetHospitalPatients = async () => {
  console.log("\n🧪 TEST 11: Get All Hospital Patients");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    const response = await axios.get(`${HOSPITAL_API}/patients`, {
      headers: {
        Authorization: `Bearer ${hospitalToken}`,
      },
    });

    console.log("✅ Success!");
    console.log(`   Hospital ID: ${response.data.hospital_id}`);
    console.log(`   Total Patients: ${response.data.total}`);

    if (response.data.patients && response.data.patients.length > 0) {
      console.log("\n   🏥 Patients:");
      response.data.patients.forEach((patient) => {
        console.log(`   - ${patient.name}`);
        console.log(`     Phone: ${patient.phone}`);
        console.log(`     Added: ${new Date(patient.added_at).toLocaleDateString()}`);
      });
    } else {
      console.log("   No patients added yet");
    }

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 12: Get Complete Hospital Information
 */
const testGetHospitalFullInfo = async () => {
  console.log("\n🧪 TEST 12: Get Hospital Full Information");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    const response = await axios.get(`${HOSPITAL_API}/info`, {
      headers: {
        Authorization: `Bearer ${hospitalToken}`,
      },
    });

    console.log("✅ Success!");
    console.log("\n   📋 Hospital Info:");
    console.log(`   ID: ${response.data.hospital.id}`);
    console.log(`   Name: ${response.data.hospital.name}`);
    console.log(`   Created: ${new Date(response.data.hospital.created_at).toLocaleDateString()}`);

    console.log(`\n   👨‍⚕️ Staff (${response.data.staff.length}):`);
    response.data.staff.forEach((doctor) => {
      console.log(`   - ${doctor.name} (${doctor.role})`);
      console.log(`     Phone: ${doctor.phone}`);
    });

    console.log(`\n   🏥 Patients (${response.data.patients.length}):`);
    response.data.patients.forEach((patient) => {
      console.log(`   - ${patient.name}`);
      console.log(`     Phone: ${patient.phone}`);
      console.log(`     Visits: ${patient.visits.length}`);
      patient.visits.forEach((visit) => {
        console.log(`       📅 ${visit.date}: ${visit.records.length} records`);
      });
    });

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Test 13: Upload Medical Record for Patient
 */
const testUploadPatientRecord = async () => {
  console.log("\n🧪 TEST 13: Upload Medical Record for Patient");
  console.log("─".repeat(50));

  if (!hospitalToken) {
    console.error("❌ No hospital token. Skipping test.");
    return;
  }

  try {
    // Create a temporary test file
    const testFileName = "test_medical_record.pdf";
    const testFilePath = `/tmp/${testFileName}`;
    fs.writeFileSync(testFilePath, "%PDF-1.4\n%Test PDF file for medical record upload");

    // Read file for upload
    const fileStream = fs.createReadStream(testFilePath);
    
    // Create form data
    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("file", fileStream);

    const response = await axios.post(
      `${HOSPITAL_API}/patients/${testPatient.phone}/records`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${hospitalToken}`,
        },
      }
    );

    console.log("✅ Success!");
    console.log(`   Record ID: ${response.data.record.id}`);
    console.log(`   Patient: ${response.data.record.patient_name}`);
    console.log(`   File Type: ${response.data.record.file_type}`);
    console.log(`   Visit Date: ${response.data.record.visit_date}`);
    console.log(`   File URL: ${response.data.record.file_url}`);
    console.log(`   Message: ${response.data.message}`);

    // Clean up
    fs.unlinkSync(testFilePath);

  } catch (error) {
    console.error("❌ Failed:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  console.log("\n" + "═".repeat(50));
  console.log("🏥 HOSPITAL, DOCTOR & PATIENT MANAGEMENT TESTS");
  console.log("═".repeat(50));
  console.log("\n⚠️  NOTE: Tests use placeholder OTP '000000'");
  console.log("   In production, replace with actual OTP from SMS");
  console.log("═".repeat(50));

  // Hospital & Doctor Tests
  await testSendHospitalOTP();
  await new Promise(r => setTimeout(r, 1000));

  await testVerifyHospitalOTP();
  await new Promise(r => setTimeout(r, 1000));

  await testHospitalLoginOTP();
  await new Promise(r => setTimeout(r, 1000));

  await testAddDoctor();
  await new Promise(r => setTimeout(r, 1000));

  await testGetHospitalDoctors();
  await new Promise(r => setTimeout(r, 1000));

  // Patient Management Tests
  await testAddExistingPatientToHospital();
  await new Promise(r => setTimeout(r, 1000));

  await testAddNonExistentPatientWithoutName();
  await new Promise(r => setTimeout(r, 1000));

  await testGetHospitalPatients();
  await new Promise(r => setTimeout(r, 1000));

  // Doctor Login Tests
  await testSendDoctorOTP();
  await new Promise(r => setTimeout(r, 1000));

  await testVerifyDoctorOTP();
  await new Promise(r => setTimeout(r, 1000));

  await testGetDoctorProfile();
  await new Promise(r => setTimeout(r, 1000));

  // Hospital Full Info Test
  await testGetHospitalFullInfo();
  await new Promise(r => setTimeout(r, 1000));

  // Patient Record Upload Test
  await testUploadPatientRecord();
  await new Promise(r => setTimeout(r, 1000));

  console.log("\n" + "═".repeat(50));
  console.log("✅ All hospital, doctor & patient tests completed!");
  console.log("═".repeat(50));
  console.log("\n📝 Integration Notes:");
  console.log("   • Hospital registration: send-otp → verify-otp (with name)");
  console.log("   • Hospital login: send-otp → verify-otp (without name)");
  console.log("   • Add patients: Only phone required, details from users table");
  console.log("   • Doctor login: send-otp → verify-otp");
  console.log("   • Upload records: POST /patients/:phone/records with file");
  console.log("   • All OTP sent via Twilio SMS service\n");
};

runAllTests();


