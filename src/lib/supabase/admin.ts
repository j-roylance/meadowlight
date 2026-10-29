import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseEnvReady,
} from "./env";

let admin: SupabaseClient | null = null;

/** Service-role client for authoritative snapshot writes (server only). */
export function createAdminSupabase(): SupabaseClient {
  if (!isSupabaseEnvReady()) {
    throw new Error("Supabase is not configured");
  }
  const key = getSupabaseServiceRoleKey();
  if (!key || key.includes("your-")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for multiplayer commands");
  }
  if (!admin) {
    admin = createClient(getSupabaseUrl()!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
