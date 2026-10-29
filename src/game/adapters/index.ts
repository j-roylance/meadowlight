import type { GameService } from "./types";
import { createLocalDemoService } from "./localDemo";
import { createSupabaseGameService } from "./supabaseGame";
import { isSupabaseEnvReady } from "@/lib/supabase/env";

export function isSupabaseConfigured(): boolean {
  return isSupabaseEnvReady();
}

/**
 * Client-side service factory.
 * - No Supabase env → local demo
 * - With env + session → call createSupabaseGameService() from AuthProvider/GameProvider
 * - Default export still returns demo so unsigned users can play offline
 */
export function createGameService(opts?: {
  mode?: "local_demo" | "multiplayer";
}): GameService {
  if (opts?.mode === "multiplayer" && isSupabaseConfigured()) {
    return createSupabaseGameService();
  }
  return createLocalDemoService();
}

export type { GameService } from "./types";
export { createSupabaseGameService } from "./supabaseGame";
export { createLocalDemoService } from "./localDemo";
