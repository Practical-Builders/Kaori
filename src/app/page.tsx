"use client";
import Link from "next/link";
import { useProfile } from "@/contexts/ProfileContext";
import { useEffect, useState } from "react";

export default function Landing() {
  const { profileComplete } = useProfile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0A0F0D", color: "white", fontFamily: "var(--font-body)" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        background: "rgba(10,15,13,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #059669, #0D9488)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 15, fontFamily: "var(--font-display)" }}>K</span>
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "white", letterSpacing: "0.12em" }}>KICKIQ</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {mounted && profileComplete ? (
            <>
              <Link href="/analyze" style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", textDecoration: "none", padding: "8px 16px" }}>
                Add Video
              </Link>
              <Link href="/profile" style={{
                fontSize: 14, fontWeight: 700, color: "white", textDecoration: "none",
                padding: "8px 20px", borderRadius: 8, background: "#059669",
              }}>
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", textDecoration: "none", padding: "8px 16px" }}>
                Sign In
              </Link>
              <Link href="/login" style={{
                fontSize: 14, fontWeight: 700, color: "white", textDecoration: "none",
                padding: "8px 20px", borderRadius: 8, background: "#059669",
              }}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 64 }}>

        {/* Background image */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <img
            src="https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1800&q=80"
            alt="Female soccer athlete"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }}
          />
          {/* Dark gradient overlay — stronger on left */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, rgba(10,15,13,0.97) 0%, rgba(10,15,13,0.85) 45%, rgba(10,15,13,0.4) 75%, rgba(10,15,13,0.6) 100%)",
          }} />
        </div>

        {/* Hero content */}
        <div style={{ position: "relative", zIndex: 10, maxWidth: 1100, margin: "0 auto", padding: "0 48px", width: "100%" }}>
          <div style={{ maxWidth: 580 }}>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32,
              padding: "6px 14px", borderRadius: 100,
              background: "rgba(5,150,105,0.15)", border: "1px solid rgba(5,150,105,0.3)",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6EE7B7", letterSpacing: "0.08em", textTransform: "uppercase" }}>AI Biomechanical Analysis</span>
            </div>

            <h1 style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(48px, 7vw, 88px)",
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              color: "white",
              marginBottom: 24,
            }}>
              Know<br />your game.
            </h1>

            <p style={{ fontSize: 18, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", marginBottom: 40, maxWidth: 460 }}>
              Upload your training footage. Get precise biomechanical measurements — speed, movement patterns, and injury risk — from AI pose analysis.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {mounted && profileComplete ? (
                <>
                  <Link href="/profile" style={{
                    display: "inline-block", padding: "16px 32px", borderRadius: 10,
                    background: "#059669", color: "white", fontWeight: 700, fontSize: 16,
                    textDecoration: "none", letterSpacing: "0.01em",
                  }}>
                    Go to Dashboard
                  </Link>
                  <Link href="/analyze" style={{
                    display: "inline-block", padding: "16px 32px", borderRadius: 10,
                    background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 600, fontSize: 16,
                    textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)",
                  }}>
                    Add Video
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" style={{
                    display: "inline-block", padding: "16px 32px", borderRadius: 10,
                    background: "#059669", color: "white", fontWeight: 700, fontSize: 16,
                    textDecoration: "none", letterSpacing: "0.01em",
                  }}>
                    Create Account
                  </Link>
                  <Link href="/analyze" style={{
                    display: "inline-block", padding: "16px 32px", borderRadius: 10,
                    background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 600, fontSize: 16,
                    textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)",
                  }}>
                    Try Without Account
                  </Link>
                </>
              )}
            </div>

            <p style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              Free to use. No subscription required.
            </p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ background: "#0E1410", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <div style={{ marginBottom: 64 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#059669", marginBottom: 12 }}>How It Works</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "white", letterSpacing: "-0.02em" }}>
              From footage to data in minutes.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {[
              {
                step: "01",
                title: "Upload Your Video",
                desc: "Upload any training or match footage. Trim it to the clip you want analyzed. Supports MP4, MOV, and WebM.",
                image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=600&q=80",
              },
              {
                step: "02",
                title: "AI Pose Analysis",
                desc: "MediaPipe tracks 33 body landmarks per frame. The engine computes joint angles, speed, stride cadence, and torque.",
                image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=600&q=80",
              },
              {
                step: "03",
                title: "Review Your Data",
                desc: "Receive a factual biomechanical report covering peak speed, movement symmetry, injury risk flags, and training recommendations.",
                image: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=600&q=80",
              },
            ].map((item) => (
              <div key={item.step} style={{ background: "#141A17", overflow: "hidden" }}>
                <div style={{ height: 220, overflow: "hidden" }}>
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
                <div style={{ padding: "28px 28px 32px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#059669", letterSpacing: "0.1em", marginBottom: 10 }}>{item.step}</p>
                  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "white", marginBottom: 10 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.5)" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section style={{ background: "#0A0F0D", padding: "80px 48px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
            {[
              { value: "33", label: "Body landmarks tracked per frame" },
              { value: "4", label: "Injury risk categories assessed" },
              { value: "m/s", label: "Speed measured in SI units" },
              { value: "100%", label: "Processed locally, not stored" },
            ].map((m) => (
              <div key={m.label} style={{ padding: "32px 24px", background: "#0E1410", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, color: "#059669", letterSpacing: "-0.02em", marginBottom: 8 }}>{m.value}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "96px 48px", background: "#0E1410", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "white", letterSpacing: "-0.02em", marginBottom: 16 }}>
            Start analyzing your movement.
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 36 }}>
            Create a free account to save sessions, track progress over time, and build a performance profile.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" style={{
              display: "inline-block", padding: "16px 36px", borderRadius: 10,
              background: "#059669", color: "white", fontWeight: 700, fontSize: 16,
              textDecoration: "none",
            }}>
              Create Free Account
            </Link>
            <Link href="/analyze" style={{
              display: "inline-block", padding: "16px 36px", borderRadius: 10,
              background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 16,
              textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)",
            }}>
              Try Without Account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: "32px 48px", background: "#0A0F0D", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>KICKIQ</span>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>For educational and training purposes only. Not a medical diagnostic tool.</p>
      </footer>
    </main>
  );
}
