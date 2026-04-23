import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModels() {
  const modelsToTest = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash'
  ];

  for (const modelName of modelsToTest) {
    try {
      console.log(`Testing ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hi');
      console.log(`✅ ${modelName} works: ${result.response.text().substring(0, 20)}...`);
    } catch (e) {
      console.error(`❌ ${modelName} failed: ${e.message.split('\n')[0]}`);
    }
  }
}

testModels();
