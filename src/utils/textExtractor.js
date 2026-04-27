import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import Tesseract from 'tesseract.js';

/**
 * Extracts text from various file formats.
 * @param {string} filePath - Path to the file
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromFile = async (filePath, mimetype) => {
  try {
    if (mimetype.startsWith('image/')) {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
      return text;
    } else if (mimetype === 'application/pdf') {
      // PDF parsing removed as per user request (rely on Gemini Vision instead)
      return '';
    } else {
      // Fallback for text files
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error('Error extracting text:', error.message);
    return '';
  }
};
