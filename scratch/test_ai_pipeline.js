console.log('--- STARTING TEST SCRIPT ---');
import { parseAIResponse, withRetry, SHORT_PROMPT } from '../src/services/aiService.js';
console.log('--- IMPORTS COMPLETED ---');


async function testParsing() {
  console.log('--- Testing JSON Parsing ---');

  const validJson = '{"is_medical_document": true, "simple_summary": "test"}';
  console.log('Valid JSON:', parseAIResponse(validJson));

  const markdownJson = '```json\n{"is_medical_document": true, "simple_summary": "markdown"}\n```';
  console.log('Markdown JSON:', parseAIResponse(markdownJson));

  const textWithJson = 'Here is the result: {"is_medical_document": false, "simple_summary": "regex"} and some more text.';
  console.log('Text with JSON:', parseAIResponse(textWithJson));

  try {
    parseAIResponse('No JSON here');
  } catch (e) {
    console.log('Invalid JSON handled:', e.message);
  }
}

async function testRetry() {
  console.log('\n--- Testing Retry Logic ---');

  let attempts = 0;
  const failingFn = async (signal) => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return { success: true, attempt: attempts };
  };

  const result = await withRetry(failingFn, 'TestRetry', 3, 1000);
  console.log('Retry Success Result:', result);

  attempts = 0;
  const timeoutFn = async (signal) => {
    attempts++;
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Aborted')));
    });
  };

  try {
    await withRetry(timeoutFn, 'TestTimeout', 2, 500);
  } catch (e) {
    console.log('Timeout handled after 2 attempts:', e.message);
  }
}

async function runTests() {
  await testParsing();
  await testRetry();
}

runTests().catch(console.error);
