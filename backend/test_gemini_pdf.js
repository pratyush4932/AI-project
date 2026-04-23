import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    
    // Create a dummy PDF file (just a minimal valid PDF)
    const pdfData = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n147\n%%EOF\n', 'utf-8');
    fs.writeFileSync('dummy.pdf', pdfData);
    
    const fileBase64 = fs.readFileSync('dummy.pdf', { encoding: 'base64' });
    
    const promptParts = [
      "What is this document?",
      {
        inlineData: {
          data: fileBase64,
          mimeType: 'application/pdf'
        }
      }
    ];
    
    console.log("Sending request to Gemini...");
    const result = await model.generateContent(promptParts);
    console.log(await result.response.text());
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
test();
