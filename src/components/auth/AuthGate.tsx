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

function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("email_address_not_authorized") || m.includes("not authorized")) {
    return "Supabase’s free built-in mailer only delivers to emails on your Supabase team. Use password sign-in below, or add custom SMTP / invite that email to the org.";
  }
  if (m.includes("rate") || m.includes("over_email")) {
    return "Email rate limit hit (built-in mailer allows ~2 emails/hour). Wait, or use password sign-in.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Wrong email or password.";
  }
  if (m.includes("user already registered")) {
    return "That email already has an account — sign in with your password.";
  }
  return raw;
}

export function AuthPanel({
  onContinueDemo,
}: {
  onContinueDemo?: () => void;
}) {
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPhase, setOtpPhase] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInPassword = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const sb = createBrowserSupabase();
      const { error: err } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : "Sign-in failed"));
    } finally {
      setBusy(false);
    }
  };

  const signUpPassword = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      const sb = createBrowserSupabase();
      const { data, error: err } = await sb.auth.signUp({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      if (data.session) {
        setMessage("Account created — you’re signed in.");
      } else {
        // Confirm-email may still be on for some projects; try immediate sign-in.
        const login = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (login.error) {
          setMessage(
            "Account created. If you aren’t signed in yet, check email for a confirm link, or try Sign in."
          );
        }
      }
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : "Sign-up failed"));
    } finally {
      setBusy(false);
    }
  };

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
      setOtpPhase("code");
      setMessage(
        "If an email arrives, enter the code (or click the magic link). On free Supabase without custom SMTP, mail only goes to org team emails and is capped at ~2/hour — password sign-in is more reliable."
      );
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : "Could not send code"));
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
      setError(friendlyAuthError(e instanceof Error ? e.message : "Invalid code"));
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

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`meadow-btn flex-1 ${method === "password" ? "meadow-btn-primary" : ""}`}
            onClick={() => {
              setMethod("password");
              setError(null);
              setMessage(null);
            }}
          >
            Email + password
          </button>
          <button
            type="button"
            className={`meadow-btn flex-1 ${method === "otp" ? "meadow-btn-primary" : ""}`}
            onClick={() => {
              setMethod("otp");
              setError(null);
              setMessage(null);
            }}
          >
            Email code
          </button>
        </div>

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

        {method === "password" ? (
          <>
            <label className="mb-3 block text-sm font-bold">
              Password
              <input
                className="meadow-btn mt-1 w-full text-left"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Password"
              />
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="meadow-btn meadow-btn-primary w-full"
                disabled={busy || !email.trim() || !password}
                onClick={() => void signInPassword()}
              >
                {busy ? "Working…" : "Sign in"}
              </button>
              <button
                type="button"
                className="meadow-btn w-full"
                disabled={busy || !email.trim() || !password}
                onClick={() => void signUpPassword()}
              >
                Create account
              </button>
            </div>
            <p className="mt-3 text-xs opacity-70">
              Recommended while using Supabase’s free mailer (no custom SMTP yet).
            </p>
          </>
        ) : otpPhase === "email" ? (
          <>
            <button
              type="button"
              className="meadow-btn meadow-btn-primary w-full"
              disabled={busy || !email.trim()}
              onClick={() => void sendOtp()}
            >
              {busy ? "Sending…" : "Email me a code"}
            </button>
            <p className="mt-3 text-xs opacity-70">
              Free Supabase only emails addresses on your org team (~2/hour). Prefer password
              sign-in unless you’ve added custom SMTP.
            </p>
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
              {busy ? "Checking…" : "Sign in with code"}
            </button>
            <button
              type="button"
              className="meadow-btn w-full"
              disabled={busy}
              onClick={() => {
                setOtpPhase("email");
                setOtp("");
              }}
            >
              Back
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
