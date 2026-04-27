import { supabase } from '../config/supabase.js';
import { processDocumentWithAI } from '../services/aiService.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const POLLING_INTERVAL_MS = 5000; // 5 seconds
const MAX_RETRIES = 3;
let isProcessing = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const processNextJob = async () => {
  if (isProcessing) return; // Prevent concurrent processing of the same loop
  isProcessing = true;

  try {
    // 1. Fetch one pending job
    const { data: jobs, error: fetchError } = await supabase
      .from('ai_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('[aiProcessor] Error fetching job:', fetchError.message);
      return;
    }

    if (!jobs || jobs.length === 0) {
      return; // No jobs pending
    }

    const job = jobs[0];

    // 2. Lock the job by marking it as 'processing'
    const { data: updatedJob, error: updateError } = await supabase
      .from('ai_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (updateError || !updatedJob) {
      // Could happen due to race condition if multiple workers exist, just return and try again next loop
      return;
    }

    console.log(`[aiProcessor] Starting job ${job.id} for file: ${job.originalname}`);

    // 3. Process the file
    try {
      let localProcessingPath = job.file_path;
      let isSupabaseFile = job.file_path.startsWith('ai-temp/');

      // If it's a Supabase path (Render mode), download it locally first
      if (isSupabaseFile) {
        console.log(`[aiProcessor] Downloading file from Supabase: ${job.file_path}`);
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('records')
          .download(job.file_path);

        if (downloadError) throw new Error(`Storage download failed: ${downloadError.message}`);

        console.log(`[aiProcessor] Download successful, blob size: ${fileBlob.size}`);

        const tempDir = os.tmpdir();
        localProcessingPath = path.join(tempDir, `medora-ai-${job.id}-${path.basename(job.file_path)}`);
        const buffer = Buffer.from(await fileBlob.arrayBuffer());
        fs.writeFileSync(localProcessingPath, buffer);
        console.log(`[aiProcessor] File written to: ${localProcessingPath}, size: ${fs.statSync(localProcessingPath).size}`);
      }

      const summaryData = await processDocumentWithAI(localProcessingPath, job.mimetype);

      const finalSummary = {
        success: true,
        fileName: job.originalname,
        ...summaryData
      };

      // 4. Update the job as completed
      await supabase
        .from('ai_jobs')
        .update({ 
          status: 'completed',
          result: finalSummary
        })
        .eq('id', job.id);

      // 5. Update Record if record_id exists
      if (job.record_id) {
        const { error: recordUpdateError } = await supabase
          .from('records')
          .update({ ai_summary: finalSummary })
          .eq('id', job.record_id);

        if (recordUpdateError) {
          console.error(`[aiProcessor] Failed to update record ${job.record_id}:`, recordUpdateError.message);
        } else {
          console.log(`[aiProcessor] Successfully updated record ${job.record_id} with AI summary`);
        }
      }

      // Also update ai_summaries_cache to be backwards compatible with caching logic
      await supabase
        .from('ai_summaries_cache')
        .upsert({
          file_hash: job.file_hash,
          summary: finalSummary
        });

      console.log(`[aiProcessor] Job ${job.id} completed successfully.`);

    } catch (processError) {
      console.error(`[aiProcessor] Job ${job.id} failed:`, processError.message);
      
      const newRetries = (job.retries || 0) + 1;
      
      if (newRetries < MAX_RETRIES) {
        console.log(`[aiProcessor] Re-queueing job ${job.id} (Retry ${newRetries}/${MAX_RETRIES})`);
        await supabase
          .from('ai_jobs')
          .update({ 
            status: 'pending',
            retries: newRetries,
            error: processError.message
          })
          .eq('id', job.id);
      } else {
        console.log(`[aiProcessor] Job ${job.id} failed after ${MAX_RETRIES} retries. Marking as failed.`);
        
        // If it completely fails, we still want to provide the safe fallback so it never hangs
        const { SAFE_FALLBACK_RESPONSE } = await import('../services/aiService.js');
        const fallbackResult = {
          success: true, // we still mark success: true so the frontend doesn't break, it just shows safe fallback
          fileName: job.originalname,
          ...SAFE_FALLBACK_RESPONSE
        };

        await supabase
          .from('ai_jobs')
          .update({ 
            status: 'failed',
            retries: newRetries,
            error: processError.message,
            result: fallbackResult
          })
          .eq('id', job.id);
      }
    } finally {
      // 6. Cleanup local file
      if (localProcessingPath && fs.existsSync(localProcessingPath)) {
        try {
          fs.unlinkSync(localProcessingPath);
          console.log(`[aiProcessor] Deleted local file: ${localProcessingPath}`);
        } catch (e) {
          console.error(`[aiProcessor] Failed to delete local file: ${localProcessingPath}`, e.message);
        }
      }

      // 7. Cleanup Supabase Storage
      if (isSupabaseFile) {
        const { error: deleteError } = await supabase.storage
          .from('records')
          .remove([job.file_path]);
        
        if (deleteError) {
          console.error(`[aiProcessor] Failed to delete Supabase file: ${job.file_path}`, deleteError.message);
        } else {
          console.log(`[aiProcessor] Deleted Supabase file: ${job.file_path}`);
        }
      }
    }

  } catch (error) {
    console.error('[aiProcessor] Unhandled worker loop error:', error.message);
  } finally {
    isProcessing = false;
  }
};

/**
 * Starts the polling loop
 */
export const startWorker = () => {
  console.log('[aiProcessor] Worker started. Polling for AI jobs...');
  // Run immediately once
  processNextJob();
  // Then start interval
  setInterval(processNextJob, POLLING_INTERVAL_MS);
};
