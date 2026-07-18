import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY müssen in .env.local gesetzt sein."
  );
}

// Kein Login-Flow im MVP (Single-User, RLS noch nicht aktiv) - ein gemeinsamer
// Client mit dem anon-Key reicht sowohl für Server- als auch Client-Components.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
