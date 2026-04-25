/**
 * Validates the structure and content of the AI response.
 * Ensure it has the required fields and correctly typed arrays.
 * 
 * @param {object} data - The parsed JSON data from the AI
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateAIResponse = (data) => {
  if (!data || typeof data !== 'object') return false;

  // Check boolean
  if (typeof data.is_medical_document !== 'boolean') return false;

  // Check string
  if (typeof data.simple_summary !== 'string' || data.simple_summary.trim() === '') return false;

  // Check arrays
  const arrayFields = ['complaints', 'findings', 'diagnosis']; // 'medications' and 'reports' could be optional depending on prompt, but let's check them if they exist
  
  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) return false;
  }

  // Check medications specifically since it's an array of objects
  if (data.medications && !Array.isArray(data.medications)) return false;

  return true;
};
