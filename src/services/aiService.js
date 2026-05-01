import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { extractTextFromFile } from '../utils/textExtractor.js';
import { cleanExtractedText } from '../utils/cleanText.js';
import { validateAIResponse } from '../utils/aiValidation.js';
import fs from 'fs';

// --- AUTH & CLIENT INITIALIZATION ---
const project = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID;
const location = process.env.LOCATION || 'us-central1';
const modelName = 'gemini-2.5-flash';

let client;
try {
  let rawAuth = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawAuth) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is missing');
  }

  // Clean up potential quotes or extra whitespace from .env
  rawAuth = rawAuth.trim().replace(/^["']|["']$/g, '');
  console.log("ADC PATH:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
  let credentials;
  if (rawAuth.startsWith('{')) {
    // PRODUCTION (Render): JSON string
    credentials = JSON.parse(rawAuth);
  } else {
    // LOCAL: Path to JSON file
    const fileContent = fs.readFileSync(rawAuth, 'utf8');
    credentials = JSON.parse(fileContent);
  }

  client = new GoogleGenAI({
    project,
    location,
    credentials,
    vertexai: true,
    apiVersion: 'v1'
  });
  console.log("✅ Medora AI: Connected via Google Gen AI SDK (Gemini 2.0 Flash)");
} catch (error) {
  console.error("❌ Medora AI Auth Error:", error.message);
}

export const SHORT_PROMPT = `Analyze the provided document (clinical note, lab report, prescription, or health-related document) and return STRICT JSON ONLY.

### OUTPUT RULES:

* RETURN ONLY A VALID JSON OBJECT.
* NO MARKDOWN (NO JSON Blocks like json).
* NO EXPLANATIONS.
* NO PRE-TEXT OR POST-TEXT.
* IF THE DOCUMENT IS NOT MEDICAL, SET is_medical_document TO false BUT STILL PROVIDE A simple_summary AND any available patient_details.

### JSON SCHEMA:

{
  "patient_details": {
    "name": "string | null",
    "age": "string | null",
    "blood_group": "string | null",
    "gender": "string | null",
  },
  "is_medical_document": boolean,
  "complaints": [],
  "medications": [],
  "findings": [],
  "diagnosis": [],
  "simple_summary": "string"
}

### DATA INTEGRITY:

1. Extract info based ONLY on the document. 
2. For missing list categories, use empty arrays []. 
3. For missing fields in 'patient_details', return null (do not invent or guess data).Add if any other form of basic data is available which is not mentioned above.
4. 'simple_summary' is REQUIRED.
5. 'is_medical_document' is boolean.

### SIMPLE SUMMARY RULES (VERY IMPORTANT):

* Write the summary as if explaining to an elderly person or someone with very basic education.
* Use VERY simple, everyday language.
* DO NOT use medical jargon (e.g., hypertension → say "high blood pressure").
* DO NOT use complex words.
* Keep sentences short and clear.
* Give the whole summary point by point. It should be easy to read.
* Mention:
  * what problem is shown (if any)
  * what the doctor checked
  * what the patient should understand
* Keep it between 40–80 words. Maximum of 7 bullet points.
* If unsure about something, say "not clearly mentioned" instead of guessing.`;

export const SAFE_FALLBACK_RESPONSE = {
  is_medical_document: false,
  complaints: [],
  medications: [],
  findings: [],
  diagnosis: [],
  simple_summary: "We could not process this document. Please refer to the original file.",
  ai_model_source: "vertex-safe-fallback"
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const parseAIResponse = (text) => {
  if (!text) throw new Error('Empty AI response');

  let cleanedText = text.trim();

  try {
    return JSON.parse(cleanedText);
  } catch (e) {
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
export const withRetry = async (fn, label, maxAttempts = 3, timeoutMs = 10000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[AI] ${label} attempt ${attempt}`);
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      console.log(`[AI] ${label} Success`);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? 'Request timed out' : (error.message || 'Unknown error');
      console.error(`[AI] ${label} attempt ${attempt} failed: ${errorMessage}`);

      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`[AI] Retry due to error, waiting ${delayMs}ms...`);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
};

/**
 * Robust AI Pipeline processing using Google Gen AI SDK
 */
export const processDocumentWithAI = async (filePath, mimetype) => {
  if (!client) {
    console.error('[AI] Client not initialized due to auth error');
    return { ...SAFE_FALLBACK_RESPONSE };
  }

  console.log(`[AI] Processing: path=${filePath}, mimetype=${mimetype}`);

  let fileBase64 = null;
  const exists = fs.existsSync(filePath);
  console.log(`[AI] File exists on disk: ${exists}`);

  if (exists) {
    fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
    console.log(`[AI] File loaded into memory, size: ${fileBase64.length} chars`);
  }

  let rawText = '';
  try {
    if (mimetype !== 'application/pdf' && fs.existsSync(filePath)) {
      rawText = await extractTextFromFile(filePath, mimetype);
    }
  } catch (err) {
    console.error('[AI] Text extraction failed:', err.message);
  }
  const cleanedText = cleanExtractedText(rawText || '');

  try {
    const data = await withRetry(async (signal) => {
      let parts = [{ text: SHORT_PROMPT }];

      const supportedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

      if (fileBase64 && mimetype && supportedMimes.includes(mimetype)) {
        parts.push({
          inlineData: {
            data: fileBase64,
            mimeType: mimetype === 'image/jpg' ? 'image/jpeg' : mimetype
          }
        });
      } else if (cleanedText && cleanedText.trim() !== '') {
        parts.push({ text: `\n\nText content to analyze:\n${cleanedText}` });
      } else {
        throw new Error('No valid input (file or text) found for AI processing');
      }

      const result = await client.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0.1,
        }
      });

      if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error('[AI] Unexpected response structure:', JSON.stringify(result, null, 2));
        throw new Error('Unexpected AI response structure');
      }

      const text = result.candidates[0].content.parts[0].text;

      const parsed = parseAIResponse(text);
      if (!validateAIResponse(parsed)) throw new Error('Invalid AI response structure');

      return parsed;
    }, 'Google Gen AI');

    if (data) {
      data.ai_model_source = `genai-${modelName}`;
      return data;
    }
  } catch (error) {
    console.error('[AI] Google Gen AI pipeline failed after all retries:', error.message);
    if (error.stack) console.error(error.stack);
  }

  // FINAL ATTEMPT: Safe Fallback
  console.log('[AI] Final fallback used');
  return { ...SAFE_FALLBACK_RESPONSE };
};
