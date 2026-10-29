import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/userClient";
import { isSupabaseEnvReady } from "@/lib/supabase/env";
import { runMultiplayerCommand } from "@/game/engine/mpRunner";
import { stringifyState } from "@/game/engine/serialize";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSupabaseEnvReady()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { command?: string; input?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const command = body.command;
  if (!command || typeof command !== "string") {
    return NextResponse.json({ ok: false, error: "command required" }, { status: 400 });
  }

  try {
    const user = await requireUser(token);
    const admin = createAdminSupabase();
    const result = await runMultiplayerCommand({
      admin,
      user,
      command,
      input: body.input,
    });
    // Bigint-safe JSON body
    return new NextResponse(stringifyState(result), {
      status: result.ok ? 200 : 400,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
