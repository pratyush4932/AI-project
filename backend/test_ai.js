import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:6363";
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

  const filePath = path.join(__dirname, 'Report.pdf');

  if (!fs.existsSync(filePath)) {
    log(`❌ Error: Report.pdf not found in ${__dirname}. Please provide a Report.pdf file to run this test.`, 'red');
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
        lastSummaryData = successData;
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

  if (!lastSummaryData) {
    log('❌ No previous summary data available to aggregate. Run summarization first (or ensure the document was a valid medical report).', 'red');
    return false;
  }

  try {
    log('\n📊 Aggregating summaries...', 'yellow');

    const payload = {
      summaryData: [
        lastSummaryData,
        lastSummaryData
      ]
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
