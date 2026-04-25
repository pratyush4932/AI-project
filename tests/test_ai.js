import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.PUBLIC_URL || "http://localhost:6363";
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
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

let lastSummaryData = null;

const testSummarizeDocument = async () => {
  separator();
  log('🧪 TEST: AI Document Summarization', 'cyan');
  separator();

  const filePath = path.join(__dirname, 'samples/Report.pdf');

  if (!fs.existsSync(filePath)) {
    log(`❌ Error: samples/Report.pdf not found in ${__dirname}. Please provide a Report.pdf file to run this test.`, 'red');
    return false;
  }

  try {
    log('\n📄 Uploading Report.pdf for summarization...', 'yellow');

    const fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append('documents', fileStream);

    const response = await axios.post(`${API_BASE_URL}/ai/summarize`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      // Optional: Since it might take some time for Gemini to process, you might want to increase timeout
      timeout: 120000,
    });

    log('✅ Document summarized successfully!', 'green');
    console.log(JSON.stringify(response.data.data, null, 2));

    if (response.data.data && response.data.data.length > 0) {
      // Find the first successful summary
      const successData = response.data.data.find(d => d.success);
      if (successData) {
        if (successData.fromCache) {
          lastSummaryData = successData;
          log('✅ Document summarized successfully (from cache)!', 'green');
        } else if (successData.jobId) {
          log(`⏳ Job ${successData.jobId} queued. Polling for status...`, 'yellow');
          let state = 'waiting';
          while (state !== 'completed' && state !== 'failed') {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const statusRes = await axios.get(`${API_BASE_URL}/ai/status/${successData.jobId}`);
              state = statusRes.data.state;
              if (state === 'completed') {
                lastSummaryData = statusRes.data.data;
                log('\n✅ Background processing completed successfully!', 'green');
                console.log(JSON.stringify(lastSummaryData, null, 2));
              } else if (state === 'failed') {
                log(`\n❌ Background processing failed: ${statusRes.data.error}`, 'red');
                return false;
              } else {
                process.stdout.write('.');
              }
            } catch (err) {
              if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
                process.stdout.write('R'); // Indicate retry
                continue;
              }
              log(`\n❌ Error polling status: ${err.message}`, 'red');
              return false;
            }
          }
        } else {
          // Fallback if structured differently
          lastSummaryData = successData;
        }
      }
    }
    return true;
  } catch (error) {
    log(`❌ Summarization failed: ${error.response?.data?.message || error.message}`, 'red');
    if (error.response?.data?.error) log(`Detail: ${error.response.data.error}`, 'red');
    return false;
  }
};

const testSummarizeSummaries = async () => {
  separator();
  log('🧪 TEST: Aggregate Medical Summaries', 'cyan');
  separator();

  let summaryDataToUse = [];

  if (lastSummaryData) {
    summaryDataToUse = [lastSummaryData, lastSummaryData];
  } else {
    log('ℹ️ No previous summary data found, using mock summaries for testing...', 'cyan');
    summaryDataToUse = [
      {
        "success": true,
        "fileName": "Report_Gen_1.pdf",
        "chief_complaints": [
          "Frequent headaches (last 1 month)",
          "Fatigue and low energy",
          "Occasional chest discomfort",
          "Increased thirst"
        ],
        "active_medications": [
          {
            "name": "Metformin",
            "dosage": "500 mg",
            "frequency": "Twice daily"
          }
        ],
        "allergies": [
          "Penicillin"
        ],
        "abnormal_findings": [
          "Hemoglobin 11.0 g/dL (Low)",
          "Fasting Glucose 145 mg/dL (High)",
          "Postprandial Glucose 210 mg/dL (High)",
          "HbA1c 7.6% (High)",
          "Total Cholesterol 260 mg/dL (High)",
          "LDL 170 mg/dL (High)",
          "HDL 35 mg/dL (Low)",
          "Triglycerides 230 mg/dL (High)",
          "SGPT (ALT) 65 U/L (High)",
          "SGOT (AST) 58 U/L (High)",
          "Creatinine 1.5 mg/dL (Elevated)",
          "Blood Pressure 155/98 mmHg (Hypertension Stage 2)",
          "ECG: Mild ST-T changes observed",
          "Type 2 Diabetes Mellitus (Early Stage)",
          "Dyslipidemia",
          "Hypertension"
        ],
        "vital_signs": [
          "Blood Pressure: 155/98 mmHg",
          "Heart Rate: 95 bpm",
          "Oxygen Saturation: 96%"
        ],
        "test_results": [
          "Hemoglobin: 11.0 g/dL",
          "WBC Count: 11,200/μL",
          "Platelets: 2.0 lakh/µL",
          "Fasting Glucose: 145 mg/dL",
          "Postprandial Glucose: 210 mg/dL",
          "HbA1c: 7.6%",
          "Total Cholesterol: 260 mg/dL",
          "LDL: 170 mg/dL",
          "HDL: 35 mg/dL",
          "Triglycerides: 230 mg/dL",
          "SGPT (ALT): 65 U/L",
          "SGOT (AST): 58 U/L",
          "Bilirubin: 1.2 mg/dL",
          "Creatinine: 1.5 mg/dL",
          "Urea: 45 mg/dL"
        ],
        "confidence_score": 0.95,
        "disclaimer": "This is an AI-generated summary for informational purposes only. Always verify with the original document and consult a qualified medical professional."
      },
      {
        "success": true,
        "fileName": "Report_Gen_2.pdf",
        "chief_complaints": [
          "Persistent headaches",
          "Fatigue and low energy",
          "Occasional chest discomfort",
          "Increased thirst"
        ],
        "active_medications": [
          {
             "name": "Metformin",
             "dosage": "500 mg",
             "frequency": "Twice daily"
          },
          {
             "name": "Atorvastatin",
             "dosage": "10 mg",
             "frequency": "Once daily"
          },
          {
             "name": "Telmisartan",
             "dosage": "40 mg",
             "frequency": "Once daily"
          }
        ],
        "allergies": [
          "Penicillin"
        ],
        "abnormal_findings": [
          "Hemoglobin 11.2 g/dL (Low)",
          "Fasting Glucose 132 mg/dL (High)",
          "Postprandial Glucose 198 mg/dL (High)",
          "HbA1c 7.2% (High)",
          "Total Cholesterol 245 mg/dL (High)",
          "LDL 160 mg/dL (High)",
          "HDL 38 mg/dL (Low)",
          "Triglycerides 210 mg/dL (High)",
          "SGPT (ALT) 62 U/L (High)",
          "SGOT (AST) 55 U/L (High)",
          "Creatinine 1.4 mg/dL (Slightly Elevated)",
          "Blood Pressure 150/95 mmHg (Hypertension Stage 1)",
          "ECG: Mild ST-T changes observed",
          "Prediabetic progressing toward Type 2 Diabetes",
          "Dyslipidemia (high cholesterol)",
          "Mild hypertension",
          "Early signs of fatty liver",
          "Borderline kidney function"
        ],
        "vital_signs": [
          "Blood Pressure: 150/95 mmHg",
          "Heart Rate: 92 bpm",
          "Oxygen Saturation: 97%"
        ],
        "test_results": [
          "Hemoglobin: 11.2 g/dL",
          "WBC Count: 10,800/μL",
          "Platelets: 2.1 lakh/µL",
          "Fasting Glucose: 132 mg/dL",
          "Postprandial Glucose: 198 mg/dL",
          "HbA1c: 7.2%",
          "Total Cholesterol: 245 mg/dL",
          "LDL: 160 mg/dL",
          "HDL: 38 mg/dL",
          "Triglycerides: 210 mg/dL",
          "SGPT (ALT): 62 U/L",
          "SGOT (AST): 55 U/L",
          "Bilirubin: 1.1 mg/dL",
          "Creatinine: 1.4 mg/dL",
          "Urea: 42 mg/dL"
        ],
        "confidence_score": 0.98,
        "disclaimer": "This is an AI-generated summary for informational purposes only. Always verify with the original document and consult a qualified medical professional."
      },
      {
        "success": true,
        "fileName": "Report_Gen_3.pdf",
        "chief_complaints": [
          "Mild headaches",
          "Improved energy levels",
          "No chest discomfort recently"
        ],
        "active_medications": [
          {
            "name": "Metformin",
            "dosage": "500 mg",
            "frequency": "Twice daily"
          },
          {
            "name": "Atorvastatin",
            "dosage": "10 mg",
            "frequency": "Once daily"
          },
          {
            "name": "Telmisartan",
            "dosage": "40 mg",
            "frequency": "Once daily"
          },
          {
            "name": "Multivitamin supplement",
            "dosage": "",
            "frequency": "Once daily"
          }
        ],
        "allergies": [
          "Penicillin"
        ],
        "abnormal_findings": [
          "Hemoglobin 11.5 g/dL (Low)",
          "Fasting Glucose 118 mg/dL (Slightly High)",
          "Postprandial Glucose 165 mg/dL (High)",
          "HbA1c 6.8% (Borderline High)",
          "Total Cholesterol 220 mg/dL (High)",
          "LDL 135 mg/dL (High)",
          "HDL 42 mg/dL (Normal)",
          "Triglycerides 185 mg/dL (High)",
          "SGPT (ALT) 50 U/L (Slightly Elevated)",
          "SGOT (AST) 45 U/L (Normal)",
          "Creatinine 1.2 mg/dL (Normal)",
          "Blood Pressure 135/85 mmHg (Elevated)",
          "Dyslipidemia",
          "Hypertension under control"
        ],
        "vital_signs": [
          "Blood Pressure: 135/85 mmHg",
          "Heart Rate: 88 bpm",
          "Oxygen Saturation: 98%"
        ],
        "test_results": [
          "Hemoglobin: 11.5 g/dL",
          "WBC Count: 9,500/μL",
          "Platelets: 2.3 lakh/µL",
          "Fasting Glucose: 118 mg/dL",
          "Postprandial Glucose: 165 mg/dL",
          "HbA1c: 6.8%",
          "Total Cholesterol: 220 mg/dL",
          "LDL: 135 mg/dL",
          "HDL: 42 mg/dL",
          "Triglycerides: 185 mg/dL",
          "SGPT (ALT): 50 U/L",
          "SGOT (AST): 45 U/L",
          "Bilirubin: 1.0 mg/dL",
          "Creatinine: 1.2 mg/dL",
          "Urea: 38 mg/dL"
        ],
        "confidence_score": 0.96,
        "disclaimer": "This is an AI-generated summary for informational purposes only. Always verify with the original document and consult a qualified medical professional."
      }
    ];
  }

  try {
    log('\n📊 Aggregating summaries...', 'yellow');

    const payload = {
      summaryData: summaryDataToUse
    };

    const response = await axios.post(`${API_BASE_URL}/ai/summarize-summaries`, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000, // Extend timeout for Gemini execution
    });

    log('✅ Summaries aggregated successfully!', 'green');
    console.log(JSON.stringify(response.data.data, null, 2));
    return true;

  } catch (error) {
    log(`❌ Aggregation failed: ${error.response?.data?.message || error.message}`, 'red');
    if (error.response?.data?.error) log(`Detail: ${error.response.data.error}`, 'red');
    return false;
  }
};

const runAITests = async () => {
  log('\n🤖 AI ENDPOINTS TEST SUITE', 'cyan');

  const menu = `
${colors.yellow}Choose test scenario:${colors.reset}
1. Test Document Summarization (/ai/summarize)
2. Test Summaries Aggregation (/ai/summarize-summaries)
3. Run All AI Tests
4. Exit

`;

  console.log(menu);
  const choice = await question('Enter choice (1-4): ');

  switch (choice) {
    case '1':
      await testSummarizeDocument();
      break;
    case '2':
      await testSummarizeSummaries();
      break;
    case '3':
      if (await testSummarizeDocument()) {
        await testSummarizeSummaries();
      }
      break;
    case '4':
      log('\n👋 Exiting AI test suite', 'yellow');
      break;
    default:
      log('\n❌ Invalid choice', 'red');
  }

  rl.close();
};

runAITests().catch((error) => {
  log(`\n❌ AI Test suite error: ${error.message}`, 'red');
  rl.close();
});
