/**
 * Supabase Client Setup & Connection Test
 * Single shared Supabase client instance for all server operations
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

export const supabase: SupabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export let dbConnected = false;
export let dbSyncError = "";

export async function testSupabaseConnection(retries = 1): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_KEY || ENV.SUPABASE_SERVICE_KEY.includes("your-supabase")) {
        dbConnected = false;
        dbSyncError = "Supabase credentials not configured in environment";
        console.warn(`[Supabase] ⚠️ Notice: ${dbSyncError}. Running with fallback memory state.`);
        return false;
      }

      const { data, error } = await supabase.from("users").select("id").limit(1);
      if (error) throw error;
      dbConnected = true;
      dbSyncError = "";
      console.log("[Supabase] ✅ Connected successfully!");
      return true;
    } catch (err: unknown) {
      const errMsg = (err as any)?.message || (err as any)?.error_description || (err instanceof Error ? err.message : (typeof err === "object" ? JSON.stringify(err) : String(err)));
      dbSyncError = errMsg || "Failed to connect to Supabase";
      dbConnected = false;
      console.warn(`[Supabase] ⚠️ Supabase connection status: ${dbSyncError}. Using resilient state fallback.`);
    }
  }
  return false;
}
