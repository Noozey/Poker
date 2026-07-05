import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../types";

// Workers don't have process.env / dotenv — config comes from env bindings
// (wrangler.jsonc "vars" for local dev, and `wrangler secret put` for prod).
export function getSupabase(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY must be set as Worker bindings");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
}
