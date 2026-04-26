import { SHORT_PROMPT, parseAIResponse } from './aiService.js';

/**
 * Fallback summarization function using OpenRouter (e.g., Mistral or LLaMA)
 * when Gemini API fails.
 * 
 * @param {string} text - The cleaned medical text
 * @returns {Promise<object>} - The structured summary
 */
export const summarizeWithFallback = async (text) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured for fallback.');
  }

  // Using a free-tier model from OpenRouter with fallbacks if rate limited
  const models = [
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'openrouter/free'
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Optional, but recommended by OpenRouter
      'HTTP-Referer': process.env.PUBLIC_URL || 'http://localhost:6363',
      'X-Title': 'Medora AI Summarizer'
    },
    body: JSON.stringify({
      models: models,
      messages: [
        { role: 'user', content: `${SHORT_PROMPT}\n\nText:\n${text}` }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  const parsedData = parseAIResponse(content);
  parsedData.ai_model_source = 'fallback-openrouter';
  return parsedData;
};
