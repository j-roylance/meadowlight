"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseEnvReady } from "./env";

export function createBrowserSupabase() {
  if (!isSupabaseEnvReady()) {
    throw new Error("Supabase is not configured");
  }
  return createBrowserClient(getSupabaseUrl()!, getSupabaseAnonKey()!);
}
