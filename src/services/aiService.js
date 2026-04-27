import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromFile } from '../utils/textExtractor.js';
import { cleanExtractedText } from '../utils/cleanText.js';
import { validateAIResponse } from '../utils/aiValidation.js';
import fs from 'fs';

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const SHORT_PROMPT = `Analyze the provided document (clinical note, lab report, prescription, or health-related document) and return STRICT JSON ONLY.

### OUTPUT RULES:
- RETURN ONLY A VALID JSON OBJECT.
- NO MARKDOWN (NO \`\`\`json blocks).
- NO EXPLANATIONS.
- NO PRE-TEXT OR POST-TEXT.
- IF THE DOCUMENT IS NOT MEDICAL, SET is_medical_document TO false BUT STILL PROVIDE A simple_summary.

### JSON SCHEMA:
{
  "is_medical_document": boolean,
  "complaints": ["symptom1"],
  "medications": [{"name": "med", "dosage": "amt", "frequency": "freq"}],
  "findings": ["finding1"],
  "reports": ["report1"],
  "diagnosis": ["diagnosis1"],
  "simple_summary": "50-100 words summary for a layperson"
}

### DATA INTEGRITY:
1. Extract info based ONLY on the document. Use empty arrays if categories are missing.
2. 'simple_summary' is REQUIRED.
3. 'is_medical_document' is boolean.
4. Do NOT invent data.`;

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
  if (!text) throw new Error('Empty AI response');
  
  // Clean potential markdown or extra text
  let cleanedText = text.trim();
  
  // 1. Direct JSON parse
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    // 2. Extract JSON using regex
    console.warn('[AI] Direct parse failed, attempting regex extraction');
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        throw new Error('Regex extraction found invalid JSON');
      }
    }
    throw new Error('Could not find JSON in AI response');
  }
};

/**
 * Utility for retrying async functions with exponential backoff and timeout
 */
export const withRetry = async (fn, label, maxAttempts = 3, timeoutMs = 8000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[AI] ${label} (attempt ${attempt}/${maxAttempts})`);
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? 'Request timed out' : error.message;
      console.error(`[AI] ${label} attempt ${attempt} failed: ${errorMessage}`);

      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await delay(delayMs);
      }
    }
  }
  throw lastError;
};

import { summarizeWithFallback } from './fallbackAI.js';



/**
 * Robust AI Pipeline processing
 */
export const processDocumentWithAI = async (filePath, mimetype) => {
  let fileBase64 = null;
  if (fs.existsSync(filePath)) {
    fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
  }

  let rawText = '';
  try {
    if (mimetype !== 'application/pdf') {
      rawText = await extractTextFromFile(filePath, mimetype);
    }
  } catch (err) {
    console.error('[AI] Text extraction failed:', err.message);
  }
  const cleanedText = cleanExtractedText(rawText || '');

  // ATTEMPT 1: Gemini Vision (if supported)
  const supportedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (fileBase64 && mimetype && supportedMimes.includes(mimetype)) {
    try {
      const data = await withRetry(async (signal) => {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const promptParts = [SHORT_PROMPT];
        promptParts.push({
          inlineData: {
            data: fileBase64,
            mimeType: mimetype === 'image/jpg' ? 'image/jpeg' : mimetype
          }
        });

        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        const parsed = parseAIResponse(text);
        
        if (!validateAIResponse(parsed)) throw new Error('Invalid AI response structure');
        return parsed;
      }, 'Gemini Vision');

      if (data) {
        data.ai_model_source = 'gemini-1.5-flash-vision';
        return data;
      }
    } catch (error) {
      console.error('[AI] Gemini Vision pipeline failed after retries');
    }
  }

  // ATTEMPT 2: Gemini Text (if text available)
  if (cleanedText && cleanedText.trim() !== '') {
    try {
      const data = await withRetry(async (signal) => {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent([SHORT_PROMPT, `\n\nText content to analyze:\n${cleanedText}`]);
        const text = result.response.text();
        const parsed = parseAIResponse(text);

        if (!validateAIResponse(parsed)) throw new Error('Invalid AI response structure');
        return parsed;
      }, 'Gemini Text');

      if (data) {
        data.ai_model_source = 'gemini-1.5-flash-text';
        return data;
      }
    } catch (error) {
      console.error('[AI] Gemini Text pipeline failed after retries');
    }
  }

  // ATTEMPT 3: OpenRouter Fallback
  try {
    console.log('[AI] Entering OpenRouter sequential fallback chain');
    const fallbackData = await summarizeWithFallback(cleanedText || 'No text extracted, but file exists.');
    
    if (fallbackData && validateAIResponse(fallbackData)) {
      return fallbackData;
    }
  } catch (error) {
    console.error('[AI] OpenRouter fallback chain exhausted or failed:', error.message);
  }

  // FINAL ATTEMPT: Safe Fallback
  console.error('[AI] CRITICAL: All AI layers failed. Returning safe fallback.');
  return { ...SAFE_FALLBACK_RESPONSE };
};

