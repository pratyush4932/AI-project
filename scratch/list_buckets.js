import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function listBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Buckets:', data.map(b => b.name));
  }
}

listBuckets();
