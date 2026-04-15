import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer the service role key on the server to perform privileged operations (bypasses RLS).
// If not provided, fall back to the regular key (useful for local dev if you only have anon key).
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY must be set");
}

// WARNING: The service role key bypasses Row Level Security. Never expose it to client-side code.
export const supabase = createClient(supabaseUrl, supabaseKey);