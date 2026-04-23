import crypto from 'crypto';
import fs from 'fs';

/**
 * Generates a SHA-256 hash of a file's contents.
 * Used for caching AI summaries to avoid duplicate processing.
 * 
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Hex representation of the SHA-256 hash
 */
export const generateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
};
