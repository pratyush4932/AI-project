import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { summarizeWithFallback } from './fallbackAI.js';
import { extractTextFromFile } from '../utils/textExtractor.js';
import { cleanExtractedText } from '../utils/cleanText.js';
import { validateAIResponse } from '../utils/aiValidation.js';
import fs from 'fs';

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
  "simple_summary": "Provide a very simple 50-100 words summary so that someone who doesn't know anything about medical terms can understand it."
}
Rules:
1. Extract information accurately based ONLY on the document. If a category (like complaints or medications) is not present in the document, use an empty array.
2. ALWAYS provide a 'simple_summary' describing what the document is about, even if all other arrays are empty. If the document is completely non-medical, state that in the summary.
3. Set 'is_medical_document' to true if the document is a medical report, lab result, prescription, or health-related. Set to false if it's unrelated (e.g., a recipe, generic receipt).
4. Return ONLY valid JSON.
5. Do not invent information. Only extract diagnoses that are explicitly stated in the document.`;

export const SAFE_FALLBACK_RESPONSE = {
  is_medical_document: false,
  complaints: [],
  medications: [],
  findings: [],
  diagnosis: [],
  simple_summary: "We could not fully process this document. Please refer to the original file.",
  ai_model_source: "safe-fallback"
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const parseAIResponse = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid JSON response from AI');
  }
};

/**
 * Robust AI Pipeline processing
 */
export const processDocumentWithAI = async (filePath, mimetype) => {
  let fileBase64 = null;
  if (fs.existsSync(filePath)) {
    fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
  }

  // ATTEMPT 1: Gemini Vision (direct file)
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const promptParts = [SHORT_PROMPT];
    const supportedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

    if (fileBase64 && mimetype && supportedMimes.includes(mimetype)) {
      promptParts.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimetype === 'image/jpg' ? 'image/jpeg' : mimetype
        }
      });

      console.log('Attempting Gemini Vision...');
      const result = await model.generateContent(promptParts);
      const parsedData = parseAIResponse(result.response.text());

      if (validateAIResponse(parsedData)) {
        parsedData.ai_model_source = 'gemini-2.5-flash-vision';
        return parsedData;
      } else {
        console.warn('Gemini Vision returned invalid structure.');
      }
    }
  } catch (error) {
    console.error('Gemini Vision failed:', error.message);
  }

  // ATTEMPT 2: Extract Text (OCR/PDF Parse) + Gemini Text
  let rawText = '';
  try {
    // Skip text extraction for PDFs (rely on Vision)
    if (mimetype !== 'application/pdf') {
      rawText = await extractTextFromFile(filePath, mimetype);
    }
    
    const cleanedText = cleanExtractedText(rawText || '');

    if (cleanedText && cleanedText.trim() !== '') {
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      console.log('Attempting Gemini Text (with extracted text)...');
      const result = await model.generateContent([SHORT_PROMPT, `\n\nText:\n${cleanedText}`]);
      const parsedData = parseAIResponse(result.response.text());

      if (validateAIResponse(parsedData)) {
        parsedData.ai_model_source = 'gemini-2.5-flash-text';
        return parsedData;
      } else {
        console.warn('Gemini Text returned invalid structure.');
      }
    }
  } catch (error) {
    console.error('Gemini Text failed:', error.message);
  }

  // ATTEMPT 3: OpenRouter Fallback
  try {
    const cleanedText = cleanExtractedText(rawText || '');
    if (cleanedText && cleanedText.trim() !== '') {
      console.log('Attempting OpenRouter fallback...');
      const fallbackData = await summarizeWithFallback(cleanedText);

      if (validateAIResponse(fallbackData)) {
        return fallbackData;
      } else {
        console.warn('OpenRouter returned invalid structure.');
      }
    }
  } catch (error) {
    console.error('OpenRouter Fallback failed:', error.message);
  }

  // ATTEMPT 4: Safe Fallback
  console.log('All AI methods failed or returned invalid data. Returning safe fallback.');
  return { ...SAFE_FALLBACK_RESPONSE };
};
