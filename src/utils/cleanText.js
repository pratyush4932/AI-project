/**
 * Cleans and limits the extracted text to reduce token usage
 * and improve AI processing efficiency.
 * 
 * @param {string} text - The raw text extracted from OCR or PDF
 * @returns {string} - Cleaned text limited to ~6000 characters
 */
export const cleanExtractedText = (text) => {
  if (!text) return '';
  
  // 1. Remove non-printable characters (keep standard text and whitespace)
  let cleaned = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
  
  // 2. Remove excessive whitespace and empty lines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 3. Limit to ~6000 characters to prevent token overflow
  // This is roughly equivalent to 1500 tokens
  if (cleaned.length > 6000) {
    cleaned = cleaned.substring(0, 6000);
  }
  
  return cleaned;
};
