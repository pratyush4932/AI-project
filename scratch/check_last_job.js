import { supabase } from '../src/config/supabase.js';

async function checkJob() {
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkJob();
