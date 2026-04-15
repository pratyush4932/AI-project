import axios from "axios";
import FormData from "form-data";
import fs from "fs";

const API_URL = "http://localhost:6969/records/upload";
const FOLDER_API_URL = "http://localhost:6969/folders/create";
const FETCH_BY_USER_ID_URL = "http://localhost:6969/records/user/589b71bb-e030-49fc-b129-569a84ead94c";
const FETCH_BY_PHONE_URL = "http://localhost:6969/records/user/phone/%2B918231033230";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU4OWI3MWJiLWUwMzAtNDlmYy1iMTI5LTU2OWE4NGVhZDk0YyIsInBob25lIjoiKzkxODIzMTAzMzIzMCIsInJvbGUiOiJwYXRpZW50IiwiaWF0IjoxNzc2MjcxMzQ4LCJleHAiOjE3NzYzNTc3NDh9.5t64pOuIZjm3LSLmwLdueAlgnzYn92lo_MD4c4bZgLg";

const FILE_PATH = "/home/pratyush/downloads/test.pdf";

/**
 * Create a test folder for patient uploads
 */
const createTestFolder = async () => {
  console.log("\n📁 Creating test folder...");
  console.log("─".repeat(50));

  try {
    const response = await axios.post(FOLDER_API_URL, 
      { name: `My Heart Beat` },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );

    const folderId = response.data.folder.id;
    console.log(`✅ Folder created! ID: ${folderId}`);
    return folderId;

  } catch (error) {
    console.error("❌ Failed to create folder:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    return null;
  }
};

/**
 * Test Case 1: Patient Upload WITH folder_id
 * Expected: folder_id = provided value, source = "patient", hospital_id = null, visit_date = null
 */
const testPatientUploadWithFolder = async (folderId) => {
  console.log("\n🧪 TEST: Patient Upload (With Folder)");
  console.log("─".repeat(50));

  if (!folderId) {
    console.error("❌ No folder ID provided. Skipping test.");
    return;
  }

  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(FILE_PATH));
    form.append("folder_id", folderId);

    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    const record = response.data.record;
    console.log("✅ Success!");
    console.log(`   Record ID: ${record.id}`);
    console.log(`   Source: ${record.source} (expected: patient)`);
    console.log(`   Folder ID: ${record.folder_id} (expected: ${folderId})`);
    console.log(`   Hospital ID: ${record.hospital_id} (expected: null)`);
    console.log(`   Visit Date: ${record.visit_date} (expected: null)`);
    console.log(`   File Type: ${record.file_type}`);

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
 * Test Case 2: Fetch all records by User ID
 */
const testFetchByUserId = async () => {
  console.log("\n🧪 TEST: Fetch Records by User ID");
  console.log("─".repeat(50));

  try {
    const response = await axios.get(FETCH_BY_USER_ID_URL);

    const { user, records_view, hospital_view } = response.data;

    console.log("✅ Success!");
    console.log(`\n👤 User Details:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Joined: ${user.created_at}`);

    console.log(`\n📁 Patient Records (Folders):`);
    if (records_view.folders.length > 0) {
      records_view.folders.forEach((folder) => {
        console.log(`   📂 ${folder.name} (${folder.records.length} records)`);
        folder.records.forEach((record) => {
          console.log(`      - ${record.id}`);
          console.log(`        File: ${record.file_type}`);
          console.log(`        Created: ${record.created_at}`);
        });
      });
    } else {
      console.log("   No patient records found.");
    }

    console.log(`\n🏥 Hospital Records:`);
    if (hospital_view.length > 0) {
      hospital_view.forEach((hospital) => {
        console.log(`   🏢 ${hospital.hospital_name}`);
        hospital.visits.forEach((visit) => {
          console.log(`      📅 ${visit.date} (${visit.records.length} records)`);
          visit.records.forEach((record) => {
            console.log(`         - ${record.id}`);
            console.log(`           File: ${record.file_type}`);
          });
        });
      });
    } else {
      console.log("   No hospital records found.");
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
 * Test Case 3: Fetch all records by Phone Number
 */
const testFetchByPhone = async () => {
  console.log("\n🧪 TEST: Fetch Records by Phone Number");
  console.log("─".repeat(50));

  try {
    const response = await axios.get(FETCH_BY_PHONE_URL);

    const { user, records_view, hospital_view } = response.data;

    console.log("✅ Success!");
    console.log(`\n👤 User Details:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Joined: ${user.created_at}`);

    console.log(`\n📁 Patient Records (Folders):`);
    if (records_view.folders.length > 0) {
      records_view.folders.forEach((folder) => {
        console.log(`   📂 ${folder.name} (${folder.records.length} records)`);
        folder.records.forEach((record) => {
          console.log(`      - ${record.id}`);
          console.log(`        File: ${record.file_type}`);
          console.log(`        Created: ${record.created_at}`);
        });
      });
    } else {
      console.log("   No patient records found.");
    }

    console.log(`\n🏥 Hospital Records:`);
    if (hospital_view.length > 0) {
      hospital_view.forEach((hospital) => {
        console.log(`   🏢 ${hospital.hospital_name}`);
        hospital.visits.forEach((visit) => {
          console.log(`      📅 ${visit.date} (${visit.records.length} records)`);
          visit.records.forEach((record) => {
            console.log(`         - ${record.id}`);
            console.log(`           File: ${record.file_type}`);
          });
        });
      });
    } else {
      console.log("   No hospital records found.");
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
const runAllTests = async () => {
  console.log("\n" + "═".repeat(50));
  console.log("📋 PATIENT RECORDS TESTS - Healthcare Grade");
  console.log("═".repeat(50));

  // Step 1: Create a test folder
  const folderId = await createTestFolder();
  await new Promise(r => setTimeout(r, 1000));

  // Step 2: Upload test file with folder
  await testPatientUploadWithFolder(folderId);
  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Fetch records by User ID
  await testFetchByUserId();
  await new Promise(r => setTimeout(r, 1000));

  // Step 4: Fetch records by Phone Number
  await testFetchByPhone();

  console.log("\n" + "═".repeat(50));
  console.log("✅ All tests completed!");
  console.log("═".repeat(50) + "\n");
};

runAllTests();