import fs from 'fs';
import path from 'path';
import { generateFileHash } from '../utils/hash.js';
import { supabase } from '../config/supabase.js';
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

      // 3. Not in cache -> Add to Queue (Supabase DB)
      const { data: job, error: insertError } = await supabase
        .from('ai_jobs')
        .insert({
          file_path: filePath,
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
      // Even if failed, we return a safe fallback result if it exists
      if (job.result) {
        return res.status(200).json({
          success: true, // We consider this a successful response from our API returning the final result
          state: 'completed', // Frontend expects 'completed' if we have data
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
      // pending or processing
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

    // Requirement: Use single model only: gemini-2.5-flash
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `${AGGREGATE_SUMMARY_PROMPT}\n\nMedical Summaries to Analyze:\n${summariesText}`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

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
