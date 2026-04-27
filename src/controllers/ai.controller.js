import fs from 'fs';
import path from 'path';
import { generateFileHash } from '../utils/hash.js';
import { supabase } from '../config/supabase.js';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

// --- AUTH & CLIENT INITIALIZATION ---
const project = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID;
const location = process.env.LOCATION || 'us-central1';
const modelName = 'gemini-2.5-flash';

let client;
try {
  let rawAuth = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (rawAuth) {
    rawAuth = rawAuth.trim().replace(/^["']|["']$/g, '');

    let credentials;
    if (rawAuth.startsWith('{')) {
      credentials = JSON.parse(rawAuth);
    } else {
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
  }
} catch (error) {
  console.error("[AI Controller] Auth Error:", error.message);
}

/**
 * Endpoint to initiate document summarization
 * Checks cache first, then queues job if not cached.
 */
export const summarizeDocument = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded. Please provide document or image files.',
      });
    }

    if (req.files.length > 3) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 files can be uploaded at once.',
      });
    }

    const results = [];

    for (const file of req.files) {
      const { originalname, path: filePath, mimetype, size } = file;

      if (size > 10 * 1024 * 1024) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        results.push({
          fileName: originalname,
          success: false,
          error: 'File size exceeds 10MB limit.',
        });
        continue;
      }

      // 1. Generate Hash
      const fileHash = await generateFileHash(filePath);

      // 2. Check Cache
      const { data: cachedData, error: dbError } = await supabase
        .from('ai_summaries_cache')
        .select('summary')
        .eq('file_hash', fileHash)
        .single();

      if (cachedData && cachedData.summary) {
        // Cache hit
        results.push({
          ...cachedData.summary,
          fileName: originalname,
          fromCache: true
        });
        // Delete local file since it's cached
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        continue;
      }

      // 3. Upload to Supabase Storage for Render Compatibility (Distributed Filesystem)
      const fileBuffer = fs.readFileSync(filePath);
      const storagePath = `ai-temp/${fileHash}-${path.basename(filePath)}`;

      const { error: uploadError } = await supabase.storage
        .from('records')
        .upload(storagePath, fileBuffer, {
          contentType: mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading to Supabase Storage:', uploadError.message);
        throw new Error('Failed to upload document for processing');
      }

      // 4. Not in cache -> Add to Queue (Supabase DB)
      const { data: job, error: insertError } = await supabase
        .from('ai_jobs')
        .insert({
          file_path: storagePath, // Now stores Supabase path
          mimetype,
          file_hash: fileHash,
          originalname,
          status: 'pending',
          priority: 'normal'
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error adding job to DB:', insertError.message);
        throw new Error('Failed to create AI job');
      }

      results.push({
        fileName: originalname,
        success: true,
        message: 'Processing started',
        jobId: job.id
      });
    }

    return res.status(200).json({
      success: true,
      data: results,
      message: 'Processing initiated.'
    });

  } catch (error) {
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }
    console.error('AI Summarization Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting document summarization.',
    });
  }
};

/**
 * Endpoint to check the status of a queued AI job
 */
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await supabase
      .from('ai_jobs')
      .select('status, result, error, retries')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const state = job.status;

    if (state === 'completed' || state === 'failed') {
      if (job.result) {
        return res.status(200).json({
          success: true,
          state: 'completed',
          data: job.result
        });
      } else {
        return res.status(200).json({
          success: false,
          state: 'failed',
          error: job.error || 'Job failed processing'
        });
      }
    } else {
      return res.status(200).json({
        success: true,
        state,
        progress: state === 'processing' ? 50 : 0
      });
    }
  } catch (error) {
    console.error('Error fetching job status:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const AGGREGATE_SUMMARY_PROMPT = `{
  "task": "Longitudinal Medical Summary Aggregation and Pattern Analysis",
  "role": "You are Medora Clinical Intelligence Engine...",
  "objective": ["Aggregate multiple medical summaries into a single unified health profile"],
  "strict_rules": ["DO NOT diagnose any disease"],
  "output_format": {
    "type": "strict_json",
    "schema": {
      "overall_health_picture": "string",
      "identified_patterns": ["string"]
    }
  }
}`;

export const summarizeSummaries = async (req, res) => {
  try {
    if (!req.body.summaryData || !Array.isArray(req.body.summaryData)) {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }

    const { summaryData } = req.body;

    if (summaryData.length === 0) {
      return res.status(400).json({ success: false, message: 'Array is empty.' });
    }

    if (summaryData.length > 10) {
      return res.status(400).json({ success: false, message: 'Max 10 summaries.' });
    }

    const summariesText = summaryData
      .map((summary, index) => `Report ${index + 1}:\n${JSON.stringify(summary, null, 2)}`)
      .join('\n---\n');

    if (!client) throw new Error('AI client not initialized');

    const prompt = `${AGGREGATE_SUMMARY_PROMPT}\n\nMedical Summaries to Analyze:\n${summariesText}`;

    const result = await client.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.1 }
    });

    const text = result.candidates[0].content.parts[0].text;

    let aggregatedData;
    try {
      aggregatedData = JSON.parse(text);
    } catch (parseError) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aggregatedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    return res.status(200).json({
      success: true,
      data: { ...aggregatedData, summary_count: summaryData.length },
      message: 'Successfully aggregated summaries.'
    });
  } catch (error) {
    console.error('Summary Aggregation Error:', error);
    return res.status(500).json({ success: false, message: 'Error aggregating summaries.' });
  }
};
