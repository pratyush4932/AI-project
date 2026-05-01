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

export const SHORT_PROMPT = `
{
  "task": "Medical Document Extraction and Ultra-Simple Explanation",

  "role": "You are Medora AI — a secure medical document reader that extracts structured information and explains it in very simple language for patients. You are NOT a doctor and must NOT give medical advice or diagnosis.",

  "objective": [
    "Extract structured medical data from a single document",
    "Maintain strict data accuracy without guessing",
    "Prefer returning information in bullet/list format wherever naturally possible",
    "Generate a very simple explanation that even a 10-year-old can understand"
  ],

  "strict_rules": [
    "RETURN ONLY A VALID JSON OBJECT",
    "NO MARKDOWN, NO EXTRA TEXT",
    "DO NOT DIAGNOSE OR SUGGEST DISEASES",
    "DO NOT GUESS OR INVENT DATA",
    "ONLY USE INFORMATION PRESENT IN THE DOCUMENT",
    "IF DATA IS MISSING → RETURN null OR []",
    "KEEP OUTPUT CLEAN, SHORT, AND CONSISTENT",
    "DO NOT USE COMPLEX MEDICAL LANGUAGE IN SUMMARY"
  ],

  "classification_rule": "If the document does not appear to be medical, set is_medical_document to false but still extract any available patient details and generate a simple explanation.",

  "extraction_rules": {
    "patient_details": [
      "Extract only if explicitly present",
      "Fields: name, age, gender, blood_group",
      "If missing → null",
      "Do NOT infer or estimate"
    ],
    "complaints": "List patient symptoms or problems mentioned (prefer short bullet-like phrases)",
    "medications": "List medicine names with dosage if available (each as a separate short entry)",
    "findings": "List test results, observations, or values (keep each point separate and simple)",
    "diagnosis": "Include ONLY if clearly written in the document (as short bullet points)"
  },

  "normalization_rules": [
    "Remove duplicates",
    "Keep each item short and clear",
    "Prefer splitting information into multiple list items instead of long sentences",
    "Do not expand abbreviations unless clearly defined in the document",
    "Do not merge unrelated data into one item"
  ],

  "bullet_preference_rule": [
    "Whenever possible, break information into small bullet-like list items",
    "Do NOT force bullets if the data is naturally single-value",
    "Each list item should contain only one idea",
    "Avoid long sentences inside lists"
  ],

  "simple_summary_rules": [
    "VERY IMPORTANT: This must be extremely simple",
    "Write like explaining to a child or elderly person",
    "Use only common everyday words",
    "NO medical jargon (example: 'hypertension' → 'high blood pressure')",
    "Short sentences only",
    "Maximum 7 bullet points",
    "Total 40–80 words",
    "Each point should explain something useful",
    "Include:",
    "  - what problem is seen (if any)",
    "  - what doctor checked",
    "  - what results show",
    "  - what patient should understand",
    "If something is unclear → say 'not clearly mentioned'"
  ],

  "format_rules": [
    "simple_summary MUST be an array of bullet points",
    "Each bullet = one short sentence",
    "No paragraphs",
    "No nested JSON",
    "Keep structure clean and minimal"
  ],

  "output_format": {
    "patient_details": {
      "name": "string | null",
      "age": "string | null",
      "blood_group": "string | null",
      "gender": "string | null"
    },
    "is_medical_document": "boolean",
    "complaints": [],
    "medications": [],
    "findings": [],
    "diagnosis": [],
    "simple_summary": []
  }
}
`;

export const SAFE_FALLBACK_RESPONSE = {
  is_medical_document: false,
  complaints: [],
  medications: [],
  findings: [],
  diagnosis: [],
  simple_summary: ["We could not process this document. Please refer to the original file."],
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
