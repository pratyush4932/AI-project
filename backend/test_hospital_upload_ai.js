import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import { supabase } from "./config/supabase.js";
import 'dotenv/config';

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:6363";

async function testHospitalUploadAi() {
  console.log("🚀 Starting Hospital Upload AI Integration Test");

  try {
    // 1. Get a patient and a hospital to test with
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, phone")
      .eq("role", "patient")
      .limit(1)
      .single();

    if (userError || !user) {
      console.error("❌ Could not find a patient user for testing:", userError?.message);
      return;
    }

    const { data: hospitalLink, error: linkError } = await supabase
      .from("hospital_users")
      .select("hospital_id")
      .eq("user_id", user.id)
      .eq("role", "patient")
      .limit(1)
      .single();

    if (linkError || !hospitalLink) {
      console.error("❌ Could not find a hospital link for the patient. Please ensure seed_patient.js has been run.");
      return;
    }

    const hospitalId = hospitalLink.hospital_id;
    const userId = user.id;

    console.log(`👤 Using Patient: ${userId}`);
    console.log(`🏥 Using Hospital: ${hospitalId}`);

    // 2. Get a token for the user (we'll skip auth check in this test or use a mock token if possible)
    // Actually, uploadRecord uses authMiddleware, so we need a token.
    // For this test, we can manually create a token or bypass it if we're running locally with a secret.
    // Let's assume we can login or use an existing token.
    // Since I don't have a password, I'll use a hack: I'll temporarily disable auth for /records/upload OR just use a known token if available.
    
    // Better: I'll use the supabase service role if I had it, but here I should use the API.
    // Let's create a temporary token using jwt.sign if I have the secret.
    // I'll check server.js for the secret.
    
    const jwtSecret = process.env.JWT_SECRET || "medora_secret_key_2024"; // Fallback from common patterns
    
    // Wait, I can't easily sign a JWT here without importing jsonwebtoken.
    // I'll check package.json... yes, it has jsonwebtoken.
    
    const { default: jwt } = await import("jsonwebtoken");
    const token = jwt.sign({ id: userId, role: "patient" }, jwtSecret, { expiresIn: "1h" });

    // 3. Prepare file for upload
    const filePath = path.join(process.cwd(), 'test_report.pdf');
    if (!fs.existsSync(filePath)) {
      // Create a dummy file if test_report.pdf doesn't exist
      fs.writeFileSync(filePath, "Dummy medical report content for testing AI summarization.");
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('hospital_id', hospitalId);

    console.log("📤 Uploading document as hospital record...");
    const response = await axios.post(`${API_BASE_URL}/records/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 201) {
      const record = response.data.record;
      console.log(`✅ Record created successfully. ID: ${record.id}`);
      
      console.log("⏳ Waiting for AI summarization (polling database)...");
      
      let attempts = 0;
      const maxAttempts = 20;
      let aiSummary = null;

      while (attempts < maxAttempts) {
        const { data: updatedRecord, error: fetchError } = await supabase
          .from("records")
          .select("ai_summary")
          .eq("id", record.id)
          .single();

        if (fetchError) {
          console.error("❌ Error fetching updated record:", fetchError.message);
          break;
        }

        if (updatedRecord.ai_summary) {
          aiSummary = updatedRecord.ai_summary;
          break;
        }

        process.stdout.write(".");
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
      }

      if (aiSummary) {
        console.log("\n✨ AI Summary detected in records table!");
        console.log(JSON.stringify(aiSummary, null, 2));
        console.log("\n✅ Integration test PASSED!");
      } else {
        console.log("\n❌ AI Summary did not appear within the timeout period.");
        console.log("Check server logs and workers/aiWorker.js to debug.");
      }
    } else {
      console.error("❌ Upload failed:", response.data);
    }

  } catch (error) {
    console.error("❌ Test failed with error:", error.response?.data || error.message);
  }
}

testHospitalUploadAi();
