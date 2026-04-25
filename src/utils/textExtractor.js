import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import Tesseract from 'tesseract.js';

/**
 * Extracts text from various file formats.
 * @param {string} filePath - Path to the file
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromFile = async (filePath, mimetype) => {
  try {
    if (mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const data = await parser.getText();
      await parser.destroy();
      return data.text;
    } else if (mimetype.startsWith('image/')) {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
      return text;
    } else {
      // Fallback for text files
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error('Error extracting text:', error.message);
    return '';
  }
};
