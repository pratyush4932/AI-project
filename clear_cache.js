import 'dotenv/config';
import { supabase } from './src/config/supabase.js';

const clearCache = async () => {
  console.log('Clearing ai_summaries_cache...');
  const { error: err1 } = await supabase
    .from('ai_summaries_cache')
    .delete()
    .neq('file_hash', 'dummy');

  if (err1) console.error('Error clearing cache:', err1.message);
  else console.log('Cache cleared successfully.');

  console.log('Clearing ai_jobs...');
  const { error: err2 } = await supabase
    .from('ai_jobs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (err2) console.error('Error clearing jobs:', err2.message);
  else console.log('Jobs cleared successfully.');
};

clearCache();
