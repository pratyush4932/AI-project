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

  // Check arrays
  const arrayFields = ['complaints', 'medications', 'findings', 'diagnosis', 'simple_summary'];

  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) return false;
  }

  return true;
};
