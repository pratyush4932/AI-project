import 'dotenv/config';
import { supabase } from '../src/config/supabase.js';

async function checkTokens() {
  const { data, error } = await supabase
    .from('qr_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching tokens:', error);
    return;
  }

  console.log('Last 5 QR Tokens:');
  data.forEach(t => {
    console.log(`Token: ${t.token}`);
    console.log(`Expires At (DB): ${t.expires_at}`);
    console.log(`Created At (DB): ${t.created_at}`);
    console.log(`Current JS Time: ${new Date().toISOString()}`);
    console.log(`Expired?: ${new Date(t.expires_at) < new Date()}`);
    console.log('---');
  });
}

checkTokens();
