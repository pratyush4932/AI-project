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
        "is_medical_document": true,
        "complaints": ["Frequent headaches", "Fatigue", "Increased thirst"],
        "medications": ["Metformin 500 mg"],
        "findings": ["Glucose 145 mg/dL", "HbA1c 7.6%"],
        "diagnosis": ["Type 2 Diabetes"],
        "simple_summary": "Initial report shows high blood sugar and signs of diabetes."
      },
      {
        "is_medical_document": true,
        "complaints": ["Persistent headaches", "Fatigue"],
        "medications": ["Metformin 500 mg", "Atorvastatin 10 mg"],
        "findings": ["Glucose 132 mg/dL", "HbA1c 7.2%"],
        "diagnosis": ["Type 2 Diabetes", "Dyslipidemia"],
        "simple_summary": "Follow-up report shows slight improvement in glucose but still elevated."
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
