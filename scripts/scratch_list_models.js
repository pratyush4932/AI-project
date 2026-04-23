import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: 'unknown'}).// wait getGenerativeModel doesn't fetch list. 
    // Actually, the SDK has an undocumented method? No, let's use fetch.
    return;
  } catch (e) {}
}

async function viaFetch() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

viaFetch();
