import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const SHORT_PROMPT = `Analyze the provided document (which may be a clinical note, lab report, prescription, or any health-related document) and return STRICT JSON ONLY. Do not wrap in markdown or backticks.
Format:
{
  "is_medical_document": true,
  "complaints": ["symptom1"],
  "medications": [{"name": "med", "dosage": "amt", "frequency": "freq"}],
  "findings": ["finding1"],
  "reports": ["report1"],
  "diagnosis": ["diagnosis1"],
  "simple_summary": "Provide a simple 2-sentence summary of the document's contents."
}
Rules:
1. Extract information accurately based ONLY on the document. If a category (like complaints or medications) is not present in the document, use an empty array.
2. ALWAYS provide a 'simple_summary' describing what the document is about, even if all other arrays are empty. If the document is completely non-medical, state that in the summary.
3. Set 'is_medical_document' to true if the document is a medical report, lab result, prescription, or health-related. Set to false if it's unrelated (e.g., a recipe, generic receipt).
4. Return ONLY valid JSON.
5. Do not invent information. Only extract diagnoses that are explicitly stated in the document.`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses the AI response text safely into JSON.
 * @param {string} text - Raw AI response text
 * @returns {object} - Parsed JSON object
 */
export const parseAIResponse = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    // If Gemini returns wrapped JSON (e.g., with markdown), try to extract it
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid JSON response from AI');
  }
};

/**
 * Summarizes text using Gemini 1.5 Flash with retry and backoff.
 * @param {string|null} fileBase64 - Base64 encoded file data
 * @param {string|null} mimeType - MIME type of the file
 * @param {string} textContent - The locally extracted medical text (fallback)
 * @param {number} retries - Number of retries on failure
 * @returns {Promise<object>} - The structured summary
 */
export const summarizeWithGemini = async (fileBase64, mimeType, textContent, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      // Use gemini-2.5-flash because pro quota is exceeded
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Delay to respect rate limits (1 second before 2nd and subsequent tries)
      if (i > 0) {
        await delay(Math.pow(2, i) * 1000); // Exponential backoff
      }

      const promptParts = [SHORT_PROMPT];

      const supportedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (fileBase64 && mimeType && supportedMimes.includes(mimeType)) {
        promptParts.push({
          inlineData: {
            data: fileBase64,
            mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
          }
        });
        // Do NOT send the fallback text if we are sending inlineData, because Gemini might be lazy 
        // and just read the fallback text (which might just say 'Page 1') instead of parsing the image/pdf.
        // if (textContent && textContent.trim() !== '') {
        //   promptParts.push(`\n\nFallback Extracted Text (in case the document text is hard to read):\n${textContent}`);
        // }
      } else {
        promptParts.push(`\n\nText:\n${textContent}`);
      }

      const result = await model.generateContent(promptParts);
      const response = await result.response;
      const responseText = response.text();

      const parsedData = parseAIResponse(responseText);
      parsedData.ai_model_source = 'gemini-2.5-flash';
      return parsedData;
    } catch (error) {
      console.error(`Gemini call failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) {
        throw error;
      }
    }
  }
};
