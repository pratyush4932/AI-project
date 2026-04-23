import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import Tesseract from 'tesseract.js';
import { cleanExtractedText } from '../utils/cleanText.js';
import { summarizeWithGemini } from '../services/aiService.js';
import { summarizeWithFallback } from '../services/fallbackAI.js';
import { supabase } from '../config/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

/**
 * Extracts text from various file formats.
 */
const extractTextFromFile = async (filePath, mimetype) => {
  if (mimetype === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text;
  } else if (mimetype.startsWith('image/')) {
    // Tesseract handles JPG/PNG
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
    return text;
  } else {
    // Fallback for raw text/docx/unsupported (requires proper library for docx in prod, but keeping simple for MVP)
    return fs.readFileSync(filePath, 'utf-8');
  }
};

export const aiWorker = new Worker('ai-processing-queue', async (job) => {
  const { filePath, mimetype, fileHash, originalname } = job.data;
  
  try {
    // 1. Extract text locally
    const rawText = await extractTextFromFile(filePath, mimetype);
    if (!rawText || rawText.trim() === '') {
      console.warn(`[Job ${job.id}] No text extracted locally, relying entirely on Gemini Vision.`);
    }

    // 2. Clean and limit text
    const cleanedText = cleanExtractedText(rawText || '');

    // Read file as base64 for Gemini Vision
    let fileBase64 = null;
    if (fs.existsSync(filePath)) {
      fileBase64 = fs.readFileSync(filePath, { encoding: 'base64' });
    }

    // 3. Summarize using Gemini with retries
    let summaryData;
    try {
      summaryData = await summarizeWithGemini(fileBase64, mimetype, cleanedText, 3);
    } catch (geminiError) {
      console.warn(`[Job ${job.id}] Gemini failed completely, attempting fallback...`);
      try {
        summaryData = await summarizeWithFallback(cleanedText);
      } catch (fallbackError) {
        console.error(`[Job ${job.id}] Fallback also failed:`, fallbackError.message);
        throw new Error('All AI providers failed to process the document.');
      }
    }

    // Prepare final output
    const finalSummary = {
      success: true,
      fileName: originalname,
      ...summaryData
    };

    // 4. Save to Supabase Cache
    const { error: dbError } = await supabase
      .from('ai_summaries_cache')
      .upsert({
        file_hash: fileHash,
        summary: finalSummary
      });

    if (dbError) {
      console.error(`[Job ${job.id}] Failed to cache summary in Supabase:`, dbError.message);
      // Don't throw, we still got the summary
    }

    // 5. Update Record if recordId provided
    if (job.data.recordId) {
      const { error: updateError } = await supabase
        .from('records')
        .update({ ai_summary: finalSummary })
        .eq('id', job.data.recordId);

      if (updateError) {
        console.error(`[Job ${job.id}] Failed to update record ${job.data.recordId}:`, updateError.message);
      } else {
        console.log(`[Job ${job.id}] Successfully updated record ${job.data.recordId} with AI summary`);
      }
    }

    // Return the summary so it can be retrieved via the Job ID
    return finalSummary;
  } catch (error) {
    console.error(`[Job ${job.id}] Error processing job:`, error.message);
    throw error;
  } finally {
    // 5. Cleanup local file to prevent memory/storage leaks
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}, { connection });

aiWorker.on('completed', (job, returnvalue) => {
  console.log(`[Worker] Job ${job.id} completed successfully for file: ${job.data.originalname}`);
});

aiWorker.on('failed', (job, error) => {
  console.log(`[Worker] Job ${job.id} failed:`, error.message);
});
