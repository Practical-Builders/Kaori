"use client";
import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";

// ── Storage keys ─────────────────────────────────────────────────────────────
const USERS_KEY  = "kickiq_users_v2";
const AUTHED_KEY = "kickiq_authed_email";
const THEME_KEY  = "kickiq_theme";

interface StoredUser { email: string; name: string; salt: string; hash: string; }

// ── Crypto helpers ────────────────────────────────────────────────────────────
function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 200_000 },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function loadUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]"); }
  catch { return []; }
}
function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Google GSI types ──────────────────────────────────────────────────────────
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [mode,     setMode]     = useState<"signin" | "register">("signin");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(AUTHED_KEY)) { router.replace("/profile"); return; }
  }, []);

  // Render Google button when GSI loads
  useEffect(() => {
    if (!gsiReady || !googleBtnRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "filled_black",
      size: "large",
      width: googleBtnRef.current.offsetWidth || 348,
      text: "continue_with",
      shape: "rectangular",
    });
  }, [gsiReady]);

  async function handleGoogleCredential(response: { credential: string }) {
    try {
      // JWTs use base64url — replace chars before decoding
      const base64 = response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      const googleEmail: string = payload.email.toLowerCase();
      const googleName: string  = payload.name ?? googleEmail;
      const users = loadUsers();
      if (!users.find(u => u.email === googleEmail)) {
        saveUsers([...users, { email: googleEmail, name: googleName, salt: "", hash: "google" }]);
      }
      sessionStorage.setItem(AUTHED_KEY, googleEmail);
      router.replace("/profile");
    } catch {
      setError("Google sign-in failed. Please try again.");
    }
  }

  function validate(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email)) return "Enter a valid email address.";
    if (!password) return "Password is required.";
    if (mode === "register") {
      if (!name.trim()) return "Name is required.";
      if (password.length < 8) return "Password must be at least 8 characters.";
      if (password !== confirm) return "Passwords do not match.";
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const users = loadUsers();
      if (mode === "register") {
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
          setError("An account with this email already exists."); return;
        }
        const salt = generateSalt();
        const hash = await hashPassword(password, salt);
        saveUsers([...users, { email: email.toLowerCase(), name: name.trim(), salt, hash }]);
        sessionStorage.setItem(AUTHED_KEY, email.toLowerCase());
        router.replace("/profile");
      } else {
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user) { setError("No account found with this email."); return; }
        const hash = await hashPassword(password, user.salt);
        if (hash !== user.hash) { setError("Incorrect password."); return; }
        sessionStorage.setItem(AUTHED_KEY, email.toLowerCase());
        router.replace("/profile");
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <>
      {GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setGsiReady(true)}
        />
      )}
      <main style={{
        minHeight: "100vh",
        background: "#0A0F0D",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        fontFamily: "var(--font-body)",
      }}>

        {/* ── Left: athlete image panel ── */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img
            src="https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=900&q=80"
            alt="Female soccer athlete"
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}
          />
          {/* Dark overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, rgba(10,15,13,0.7) 0%, rgba(10,15,13,0.3) 60%, rgba(10,15,13,0.6) 100%)",
          }} />
          {/* Logo top-left */}
          <Link href="/" style={{
            position: "absolute", top: 32, left: 36,
            display: "flex", alignItems: "center", gap: 10, textDecoration: "none", zIndex: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #059669, #0D9488)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 15, fontFamily: "var(--font-display)" }}>K</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "white", letterSpacing: "0.12em" }}>KICKIQ</span>
          </Link>
          {/* Quote bottom-left */}
          <div style={{ position: "absolute", bottom: 48, left: 36, right: 36, zIndex: 10 }}>
            <p style={{
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.1,
              color: "white", letterSpacing: "-0.02em", marginBottom: 12,
            }}>
              Know<br />your game.
            </p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 320 }}>
              AI-powered biomechanical analysis for serious athletes.
            </p>
          </div>
        </div>

        {/* ── Right: form panel ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "48px 56px", background: "#0A0F0D", position: "relative", overflowY: "auto",
        }}>

          {/* Subtle aurora glow top-right */}
          <div style={{
            position: "absolute", top: "-10%", right: "-10%", width: 400, height: 400,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(52,211,153,0.09) 0%, transparent 70%)",
            filter: "blur(40px)",
          }} />
          <div style={{
            position: "absolute", bottom: "-5%", left: "-5%", width: 300, height: 300,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)",
            filter: "blur(50px)",
          }} />

          <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>

            {/* Heading */}
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32,
              color: "white", letterSpacing: "-0.02em", marginBottom: 6,
            }}>
              {mode === "signin" ? "Welcome back." : "Create account."}
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
              {mode === "signin"
                ? "Sign in to access your performance data."
                : "Start tracking your biomechanics for free."}
            </p>

            {/* Google Sign-In — only shown when client ID is configured */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div style={{ marginBottom: 20 }}>
                  {gsiReady ? (
                    <div ref={googleBtnRef} style={{ width: "100%" }} />
                  ) : (
                    <div style={{
                      width: "100%", padding: "13px", borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center",
                    }}>
                      Loading Google Sign-In…
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>or</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mode === "register" && (
                <input type="text" placeholder="Full name" value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  autoComplete="name"
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 15,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "white", outline: "none", boxSizing: "border-box",
                    fontFamily: "var(--font-body)",
                  }}
                />
              )}

              <input type="email" placeholder="Email address" value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                autoComplete="email"
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 15,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                  color: "white", outline: "none", boxSizing: "border-box",
                  fontFamily: "var(--font-body)",
                }}
              />

              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Password" value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  style={{
                    width: "100%", padding: "13px 54px 13px 16px", borderRadius: 10, fontSize: 15,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "white", outline: "none", boxSizing: "border-box",
                    fontFamily: "var(--font-body)",
                  }}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600,
                    fontFamily: "var(--font-body)", padding: 0,
                  }}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>

              {mode === "register" && (
                <input type="password" placeholder="Confirm password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(""); }}
                  autoComplete="new-password"
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 15,
                    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                    color: "white", outline: "none", boxSizing: "border-box",
                    fontFamily: "var(--font-body)",
                  }}
                />
              )}

              {mode === "register" && (
                <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.2)", marginTop: -2 }}>
                  Minimum 8 characters. Passwords are hashed locally and never sent to any server.
                </p>
              )}

              {error && (
                <p style={{
                  fontSize: 13, color: "#FCA5A5", fontWeight: 500,
                  padding: "10px 13px", background: "rgba(220,38,38,0.12)",
                  borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)",
                }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "14px", borderRadius: 10, marginTop: 4,
                  background: loading ? "rgba(5,150,105,0.4)" : "linear-gradient(135deg,#059669,#0D9488)",
                  color: "white", fontWeight: 700, fontSize: 15, border: "none",
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-body)",
                  boxShadow: loading ? "none" : "0 4px 24px rgba(5,150,105,0.35)",
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* Mode switch */}
            <p style={{ marginTop: 24, fontSize: 13.5, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button type="button"
                onClick={() => { setMode(m => m === "signin" ? "register" : "signin"); setError(""); setPassword(""); setConfirm(""); }}
                style={{
                  background: "none", border: "none", color: "#10B981",
                  fontWeight: 700, cursor: "pointer", fontSize: 13.5,
                  fontFamily: "var(--font-body)", padding: 0,
                }}>
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </p>

            <Link href="/analyze" style={{
              marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.2)",
              textDecoration: "none", textAlign: "center", display: "block",
            }}>
              Continue without account
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
