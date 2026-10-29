import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/** User-scoped client from a bearer access token (API routes). */
export function createUserSupabase(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl()!, getSupabaseAnonKey()!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(accessToken: string): Promise<User> {
  const sb = createUserSupabase(accessToken);
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }
  return data.user;
}
