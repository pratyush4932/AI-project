import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Use Redis URL from env or fallback to local
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const aiQueue = new Queue('ai-processing-queue', { connection });

/**
 * Adds a document summarization job to the queue
 * @param {object} jobData - Data containing file info and hash
 * @returns {Promise<import('bullmq').Job>}
 */
export const addAiJob = async (jobData) => {
  return await aiQueue.add('summarize-document', jobData, {
    removeOnComplete: {
      age: 3600, // Keep for 1 hour
      count: 1000 // Keep last 1000 jobs
    },
    removeOnFail: false,    // Keep failed jobs for debugging
    attempts: 1             // We handle retry logic inside the worker for the AI calls
  });
};
