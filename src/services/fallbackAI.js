import { SHORT_PROMPT, parseAIResponse, withRetry } from './aiService.js';

/**
 * Fallback summarization function using OpenRouter with sequential model failover.
 * 
 * @param {string} text - The medical text to analyze
 * @returns {Promise<object>} - The structured summary
 */
export const summarizeWithFallback = async (text) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[AI] OpenRouter API key missing');
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const models = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-12b-it:free'
  ];

  for (const model of models) {
    try {
      const data = await withRetry(async (signal) => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.PUBLIC_URL || 'http://localhost:6363',
            'X-Title': 'Medora AI'
          },
          body: JSON.stringify({
            model: model, // Single model per request
            messages: [
              { role: 'user', content: `${SHORT_PROMPT}\n\nAnalyze this medical text:\n${text}` }
            ],
            temperature: 0.1 // Keep it deterministic
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        if (!result.choices?.[0]?.message?.content) {
          throw new Error('Empty response from OpenRouter');
        }

        const parsedData = parseAIResponse(result.choices[0].message.content);
        parsedData.ai_model_source = `openrouter-${model}`;
        return parsedData;
      }, `OpenRouter:${model}`);

      if (data) return data;
    } catch (error) {
      console.error(`[AI] Model ${model} failed all retries. Trying next model...`);
    }
  }

  throw new Error('All OpenRouter models failed.');
};
