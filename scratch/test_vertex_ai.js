import 'dotenv/config';
import { processDocumentWithAI } from '../src/services/aiService.js';
import path from 'path';

async function runTest() {
  const filePath = 'uploads/documents/1776452353996-256284563.pdf';
  const mimetype = 'application/pdf';

  console.log('--- Testing Vertex AI Integration ---');
  console.log(`File: ${filePath}`);
  console.log(`Mimetype: ${mimetype}`);

  try {
    const result = await processDocumentWithAI(filePath, mimetype);
    console.log('\n--- AI RESULT ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n--- TEST FAILED ---');
    console.error(error);
  }
}

runTest();
