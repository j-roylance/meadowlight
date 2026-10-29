"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseEnvReady } from "@/lib/supabase/env";

export type AuthMode = "demo" | "signed_out" | "signed_in";

export function useAuthSession() {
  const configured = isSupabaseEnvReady();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;
    const sb = createBrowserSupabase();
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const mode: AuthMode = !configured
    ? "demo"
    : !ready
      ? "signed_out"
      : session
        ? "signed_in"
        : "signed_out";

  return { configured, session, ready, mode };
}

export function AuthPanel({
  onContinueDemo,
}: {
  onContinueDemo?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const sb = createBrowserSupabase();
      const { error: err } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (err) throw err;
      setPhase("otp");
      setMessage("Check your email for a one-time code (local Inbucket: http://127.0.0.1:54324).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const sb = createBrowserSupabase();
      const { error: err } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (err) throw err;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="meadow-panel w-full max-w-md p-6">
        <h1 className="meadow-title mb-1 text-3xl">Meadowlight</h1>
        <p className="mb-4 text-sm opacity-80">
          Sign in to save your city to your account and visit real neighbors.
        </p>
        {phase === "email" ? (
          <>
            <label className="mb-2 block text-sm font-bold">
              Email
              <input
                className="meadow-btn mt-1 w-full text-left"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
              />
            </label>
            <button
              type="button"
              className="meadow-btn meadow-btn-primary w-full"
              disabled={busy || !email.trim()}
              onClick={() => void sendOtp()}
            >
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </>
        ) : (
          <>
            <label className="mb-2 block text-sm font-bold">
              One-time code
              <input
                className="meadow-btn mt-1 w-full text-left"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                aria-label="One-time code"
              />
            </label>
            <button
              type="button"
              className="meadow-btn meadow-btn-primary mb-2 w-full"
              disabled={busy || !otp.trim()}
              onClick={() => void verifyOtp()}
            >
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button
              type="button"
              className="meadow-btn w-full"
              disabled={busy}
              onClick={() => {
                setPhase("email");
                setOtp("");
              }}
            >
              Use a different email
            </button>
          </>
        )}
        {message && <p className="mt-3 text-sm opacity-80">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
        {onContinueDemo && (
          <button
            type="button"
            className="meadow-btn mt-4 w-full"
            onClick={onContinueDemo}
          >
            Continue in local demo (this browser only)
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const { configured, ready, mode } = useAuthSession();
  const [forceDemo, setForceDemo] = useState(false);

  if (!configured || forceDemo) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="meadow-panel p-6 meadow-title text-2xl">Checking session…</div>
      </div>
    );
  }

  if (mode === "signed_out") {
    return <AuthPanel onContinueDemo={() => setForceDemo(true)} />;
  }

  return <>{children}</>;
}
