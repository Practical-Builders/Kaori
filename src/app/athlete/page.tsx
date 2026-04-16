"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useProfile, AnalysisSession } from "@/contexts/ProfileContext";

// ── Jalisqueñas FC athletes (must stay in sync with discover/page.tsx) ─────────
const DEMO_ATHLETES = [
  {
    id: "demo1", name: "Edith Hernández", age: 16, position: "Striker", secondaryPosition: "Forward",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Sophomore",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 165, weightKg: 58,
    dominantFoot: "Right", yearsPlaying: 8,
    bio: "Clinical finisher with explosive acceleration. Dangerous on and off the ball — reads the defense before the pass arrives.",
    peakSpeedMs: 8.4, symmetryScore: 88, sessions: 6, risk: "low",
    moves: ["One-Touch Finish", "Run in Behind", "Hold-Up Play", "Late Run"],
    photo: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=400&q=80",
    goals: "16", assists: "5", appearances: "13", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
  {
    id: "demo2", name: "Fernanda Sánchez", age: 15, position: "Attacking Mid", secondaryPosition: "Midfielder",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Freshman",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 161, weightKg: 55,
    dominantFoot: "Left", yearsPlaying: 7,
    bio: "Creative playmaker with natural vision and technique beyond her age. Links play effortlessly and delivers in tight spaces.",
    peakSpeedMs: 7.6, symmetryScore: 91, sessions: 5, risk: "low",
    moves: ["Through Ball", "Dribble into Box", "Free Kick", "Press Trigger"],
    photo: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=400&q=80",
    goals: "7", assists: "14", appearances: "12", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
  {
    id: "demo3", name: "Ines Romano", age: 16, position: "Winger", secondaryPosition: "Forward",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Sophomore",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 163, weightKg: 57,
    dominantFoot: "Right", yearsPlaying: 6,
    bio: "Rapid wide forward who lives off 1v1 duels. Cuts inside onto her stronger foot and has an eye for goal from range.",
    peakSpeedMs: 8.8, symmetryScore: 85, sessions: 4, risk: "moderate",
    moves: ["Sprint in Behind", "Cutback", "1v1 Dribble", "Inverted Cut"],
    photo: "/athletes/ines.jpeg",
    goals: "11", assists: "9", appearances: "14", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
  {
    id: "demo4", name: "Joca Cervantes", age: 15, position: "Center Back", secondaryPosition: "Defensive Mid",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Freshman",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 169, weightKg: 63,
    dominantFoot: "Right", yearsPlaying: 7,
    bio: "Composed, dominant defender who reads the game two steps ahead. Comfortable bringing the ball out from the back under pressure.",
    peakSpeedMs: 7.2, symmetryScore: 90, sessions: 7, risk: "low",
    moves: ["Aerial Duel", "Recovery Run", "Long Ball Switch", "Stepping Out"],
    photo: "/athletes/joca.jpeg",
    goals: "2", assists: "3", appearances: "15", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
  {
    id: "demo5", name: "Lumi Keppo", age: 16, position: "Goalkeeper", secondaryPosition: "",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Sophomore",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 172, weightKg: 65,
    dominantFoot: "Right", yearsPlaying: 5,
    bio: "Elite shot-stopper with fast reflexes and calm distribution. Commands her box confidently and sweeps behind the line when needed.",
    peakSpeedMs: 6.5, symmetryScore: 93, sessions: 8, risk: "low",
    moves: ["Shot Stop", "Sweeper Keeper", "Distribution", "Command of Area"],
    photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&q=80",
    goals: "0", assists: "2", appearances: "16", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
  {
    id: "demo6", name: "Melina González", age: 15, position: "Midfielder", secondaryPosition: "Defensive Mid",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Freshman",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 162, weightKg: 57,
    dominantFoot: "Both", yearsPlaying: 6,
    bio: "Box-to-box engine with tireless work rate and a sharp football brain. Wins the ball back quickly and distributes without fuss.",
    peakSpeedMs: 7.9, symmetryScore: 87, sessions: 5, risk: "low",
    moves: ["Box-to-Box Run", "Interception", "Through Ball", "Press Trigger"],
    photo: "/athletes/melina.jpeg",
    goals: "4", assists: "11", appearances: "13", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
  {
    id: "demo7", name: "Niza Verona", age: 16, position: "Full Back", secondaryPosition: "Winger",
    location: "Mexico City, Mexico", nationality: "Mexico", club: "Jalisqueñas FC", academicYear: "Sophomore",
    targetLeague: "Liga MX Femenil", openToRecruitment: true, heightCm: 160, weightKg: 56,
    dominantFoot: "Left", yearsPlaying: 7,
    bio: "Attack-minded left back with an electric engine and dangerous delivery. Tracks back diligently but is at her best bombing forward.",
    peakSpeedMs: 8.1, symmetryScore: 89, sessions: 6, risk: "low",
    moves: ["Overlap Run", "Cross", "Recovery Sprint", "Tuck Inside"],
    photo: "/athletes/niza.jpeg",
    goals: "5", assists: "13", appearances: "14", instagram: "",
    gpa: "", passCompletion: "", email: "",
  },
];

function riskColor(r?: string) {
  if (r === "low") return "#10B981";
  if (r === "moderate") return "#FBBF24";
  return "#F87171";
}

// ── Inner component that reads search params ──────────────────────────────────
function AthleteProfileInner() {
  const searchParams = useSearchParams();
  const athleteId = searchParams.get("id");
  const { profile, sessions } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  if (!mounted) return null;

  // ── Demo athlete view ──
  const demoAthlete = athleteId ? DEMO_ATHLETES.find(a => a.id === athleteId) : null;

  if (demoAthlete) {
    const performanceStats = [
      { label: "Sessions Analyzed", value: String(demoAthlete.sessions), color: "#A78BFA" },
      { label: "Peak Speed", value: `${demoAthlete.peakSpeedMs} m/s`, color: "#10B981" },
      { label: "Symmetry Score", value: `${demoAthlete.symmetryScore}%`, color: "#06B6D4" },
      { label: "Injury Risk", value: demoAthlete.risk.charAt(0).toUpperCase() + demoAthlete.risk.slice(1), color: riskColor(demoAthlete.risk) },
      ...(demoAthlete.goals ? [{ label: "Goals", value: demoAthlete.goals, color: "#FBBF24" }] : []),
      ...(demoAthlete.assists ? [{ label: "Assists", value: demoAthlete.assists, color: "#F87171" }] : []),
      ...(demoAthlete.appearances ? [{ label: "Appearances", value: demoAthlete.appearances, color: "#34D399" }] : []),
    ];

    const infoCards = [
      { label: "Position", value: demoAthlete.position },
      ...(demoAthlete.secondaryPosition ? [{ label: "Secondary", value: demoAthlete.secondaryPosition }] : []),
      { label: "Club", value: demoAthlete.club },
      { label: "Height", value: `${demoAthlete.heightCm} cm` },
      { label: "Weight", value: `${demoAthlete.weightKg} kg` },
      { label: "Dominant Foot", value: demoAthlete.dominantFoot },
      { label: "Years Playing", value: `${demoAthlete.yearsPlaying} yrs` },
      { label: "Academic Year", value: demoAthlete.academicYear },
    ];

    return (
      <main style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "var(--font-body)", color: "white" }}>
        <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(10,15,13,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "var(--font-display)" }}>K</span>
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", letterSpacing: "0.1em" }}>KICKIQ</span>
            </Link>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link href="/discover" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>← All Athletes</Link>
              <Link href="/profile" style={{ fontSize: 13, fontWeight: 700, color: "white", textDecoration: "none", padding: "7px 16px", borderRadius: 8, background: "#059669" }}>My Dashboard</Link>
            </div>
          </div>
        </nav>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>

          {/* ── Banner ── */}
          <div style={{ height: 180, borderRadius: "20px 20px 0 0", background: "linear-gradient(135deg,#0B2D1F,#0A1A2E,#1A0A2E)", position: "relative", overflow: "hidden", marginBottom: 0 }}>
            <div style={{ position: "absolute", inset: 0, background: "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=60') center/cover no-repeat", opacity: 0.15 }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(10,15,13,0.9) 100%)" }} />
          </div>

          {/* ── Hero card ── */}
          <div style={{ background: "#111816", border: "1px solid rgba(5,150,105,0.2)", borderTop: "none", borderRadius: "0 0 24px 24px", padding: "0 36px 36px", marginBottom: 24, position: "relative" }}>
            {/* Photo (overlaps banner) */}
            <div style={{ marginTop: -52, marginBottom: 16 }}>
              <div style={{ width: 96, height: 96, borderRadius: 22, overflow: "hidden", border: "4px solid #0A0F0D", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "inline-block", background: "linear-gradient(135deg,#059669,#0D9488)", position: "relative" }}>
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", inset: 0 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 40, color: "white" }}>{demoAthlete.name.charAt(0)}</span>
                </div>
                <img
                  src={demoAthlete.photo}
                  alt={demoAthlete.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: "white", margin: 0 }}>{demoAthlete.name}</h1>
                  {demoAthlete.openToRecruitment && (
                    <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 100, padding: "4px 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Open to Recruit</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(5,150,105,0.12)", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6, padding: "4px 10px" }}>{demoAthlete.position}</span>
                  {demoAthlete.secondaryPosition && <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", borderRadius: 6, padding: "4px 10px" }}>{demoAthlete.secondaryPosition}</span>}
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>🌍 {demoAthlete.nationality}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>📍 {demoAthlete.location}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Age {demoAthlete.age}</span>
                </div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 520 }}>{demoAthlete.bio}</p>
                {demoAthlete.targetLeague && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Target League:</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{demoAthlete.targetLeague}</span>
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {!contactSent ? (
                  <button onClick={() => setContactSent(true)} style={{ padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(5,150,105,0.4)" }}>
                    Express Interest
                  </button>
                ) : (
                  <div style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
                    Interest Sent ✓
                  </div>
                )}
                <Link href="/discover" style={{ display: "block", padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                  Back to Discover
                </Link>
              </div>
            </div>
          </div>

          {/* ── Performance Stats ── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "white", marginBottom: 14 }}>Performance Data</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {performanceStats.map(s => (
                <div key={s.label} style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 16px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</p>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Athlete info */}
            <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 16 }}>Athlete Info</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {infoCards.map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Movement patterns */}
            <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 14 }}>Movement Patterns</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {demoAthlete.moves.map(m => (
                  <span key={m} style={{ fontSize: 13, fontWeight: 700, background: "rgba(5,150,105,0.1)", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "6px 14px" }}>{m}</span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                Movement patterns detected via MediaPipe AI pose analysis across {demoAthlete.sessions} training sessions.
              </p>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 32, lineHeight: 1.5 }}>
            Performance data generated by AI biomechanical analysis. For educational purposes only — not a medical diagnostic tool.
          </p>
        </div>
      </main>
    );
  }

  // ── Current user profile view ──
  const hasProfile = Boolean(profile.name && profile.primaryPosition);

  const bestSpeed = sessions.filter(s => s.peakSpeedMs).length
    ? Math.max(...sessions.filter(s => s.peakSpeedMs).map(s => s.peakSpeedMs!))
    : null;
  const avgSymmetry = sessions.filter(s => s.symmetryScore).length
    ? sessions.filter(s => s.symmetryScore).reduce((a, s) => a + s.symmetryScore!, 0) /
      sessions.filter(s => s.symmetryScore).length
    : null;
  const latestSession = sessions[0];
  const allMoves = Array.from(new Set(sessions.flatMap(s => s.movesIdentified || []))).slice(0, 10);
  const topSuggestions = Array.from(new Set(sessions.flatMap(s => s.trainingSuggestions || []))).slice(0, 3);

  const statCards = [
    { label: "Position", value: profile.primaryPosition || "—" },
    { label: "Club", value: profile.currentClub || "—" },
    { label: "Height", value: profile.heightCm ? `${profile.heightCm} cm` : "—" },
    { label: "Weight", value: profile.weightKg ? `${profile.weightKg} kg` : "—" },
    { label: "Dominant Foot", value: profile.dominantFoot ? profile.dominantFoot.charAt(0).toUpperCase() + profile.dominantFoot.slice(1) : "—" },
    { label: "Years Playing", value: profile.yearsPlaying ? `${profile.yearsPlaying} yrs` : "—" },
    { label: "Academic Year", value: profile.academicYear || "—" },
    { label: "GPA", value: profile.gpa || "—" },
  ].filter(s => s.value !== "—");

  const performanceStats = [
    { label: "Sessions Analyzed", value: String(sessions.length), color: "#A78BFA" },
    ...(bestSpeed ? [{ label: "Peak Speed", value: `${bestSpeed.toFixed(2)} m/s`, color: "#10B981" }] : []),
    ...(avgSymmetry ? [{ label: "Avg Symmetry", value: `${avgSymmetry.toFixed(1)}%`, color: "#06B6D4" }] : []),
    ...(profile.goals ? [{ label: "Goals", value: profile.goals, color: "#FBBF24" }] : []),
    ...(profile.assists ? [{ label: "Assists", value: profile.assists, color: "#F87171" }] : []),
    ...(profile.appearances ? [{ label: "Appearances", value: profile.appearances, color: "#34D399" }] : []),
    ...(profile.passCompletion ? [{ label: "Pass Completion", value: `${profile.passCompletion}%`, color: "#60A5FA" }] : []),
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "var(--font-body)", color: "white" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(10,15,13,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "var(--font-display)" }}>K</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", letterSpacing: "0.1em" }}>KICKIQ</span>
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/discover" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>← All Athletes</Link>
            <Link href="/profile" style={{ fontSize: 13, fontWeight: 700, color: "white", textDecoration: "none", padding: "7px 16px", borderRadius: 8, background: "#059669" }}>My Dashboard</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>

        {!hasProfile ? (
          <div style={{ padding: "80px 24px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, color: "white", marginBottom: 12 }}>Profile Not Set Up</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, marginBottom: 28 }}>Complete your profile to share it with recruiters.</p>
            <Link href="/profile" style={{ padding: "14px 32px", borderRadius: 14, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-block" }}>Set Up Profile →</Link>
          </div>
        ) : (
          <>
            {/* ── Banner ── */}
            <div style={{ height: 180, borderRadius: "20px 20px 0 0", background: "linear-gradient(135deg,#0B2D1F,#0A1A2E)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=60') center/cover no-repeat", opacity: 0.15 }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(10,15,13,0.9) 100%)" }} />
            </div>

            {/* ── Hero card ── */}
            <div style={{ background: "#111816", border: "1px solid rgba(5,150,105,0.2)", borderTop: "none", borderRadius: "0 0 24px 24px", padding: "0 36px 36px", marginBottom: 24, position: "relative" }}>
              {/* Photo (overlaps banner) */}
              <div style={{ marginTop: -52, marginBottom: 16 }}>
                <div style={{ width: 96, height: 96, borderRadius: 22, overflow: "hidden", border: "4px solid #0A0F0D", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "inline-block" }}>
                  {profile.photoUrl
                    ? <img src={profile.photoUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 40, color: "white" }}>{profile.name.charAt(0).toUpperCase()}</span>
                      </div>}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: "white", margin: 0 }}>{profile.name}</h1>
                    {profile.openToRecruitment && (
                      <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 100, padding: "4px 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Open to Recruit</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {profile.primaryPosition && <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(5,150,105,0.12)", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6, padding: "4px 10px" }}>{profile.primaryPosition}</span>}
                    {profile.secondaryPosition && <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", borderRadius: 6, padding: "4px 10px" }}>{profile.secondaryPosition}</span>}
                    {profile.nationality && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>🌍 {profile.nationality}</span>}
                    {profile.location && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>📍 {profile.location}</span>}
                    {profile.age && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Age {profile.age}</span>}
                  </div>
                  {profile.bio && <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 520 }}>{profile.bio}</p>}
                  {profile.targetLeague && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Target League:</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{profile.targetLeague}</span>
                    </div>
                  )}
                </div>

                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {!contactSent ? (
                    <button onClick={() => setContactSent(true)} style={{ padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(5,150,105,0.4)" }}>
                      Express Interest
                    </button>
                  ) : (
                    <div style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
                      Interest Sent ✓
                    </div>
                  )}
                  {profile.email && (
                    <a href={`mailto:${profile.email}`} style={{ display: "block", padding: "10px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                      Email Athlete
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Performance Stats ── */}
            {performanceStats.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "white", marginBottom: 14 }}>Performance Data</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                  {performanceStats.map(s => (
                    <div key={s.label} style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 16px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</p>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              {statCards.length > 0 && (
                <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 16 }}>Athlete Info</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {statCards.map(s => (
                      <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 10 }}>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {latestSession && (
                <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 16 }}>Latest Session</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>{new Date(latestSession.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[
                      { l: "Peak Speed", v: latestSession.peakSpeedMs ? `${latestSession.peakSpeedMs.toFixed(2)} m/s` : "—" },
                      { l: "Symmetry", v: latestSession.symmetryScore ? `${latestSession.symmetryScore.toFixed(1)}%` : "—" },
                      { l: "Stride Count", v: latestSession.strideCount ? String(latestSession.strideCount) : "—" },
                      { l: "Injury Risk", v: latestSession.overallRisk ? latestSession.overallRisk.charAt(0).toUpperCase() + latestSession.overallRisk.slice(1) : "—" },
                    ].map(d => (
                      <div key={d.l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{d.l}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: d.l === "Injury Risk" ? riskColor(latestSession.overallRisk) : "rgba(255,255,255,0.8)" }}>{d.v}</p>
                      </div>
                    ))}
                  </div>
                  {latestSession.geminiSummary && (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{latestSession.geminiSummary.slice(0, 180)}{latestSession.geminiSummary.length > 180 ? "…" : ""}</p>
                  )}
                </div>
              )}
            </div>

            {allMoves.length > 0 && (
              <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px", marginBottom: 24 }}>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 14 }}>Detected Movement Patterns</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allMoves.map(m => (
                    <span key={m} style={{ fontSize: 13, fontWeight: 700, background: "rgba(5,150,105,0.1)", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "6px 14px" }}>{m}</span>
                  ))}
                </div>
              </div>
            )}

            {topSuggestions.length > 0 && (
              <div style={{ background: "linear-gradient(135deg,rgba(5,150,105,0.06),rgba(6,182,212,0.04))", border: "1px solid rgba(5,150,105,0.15)", borderRadius: 18, padding: "24px", marginBottom: 24 }}>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 14 }}>AI Training Focus Areas</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topSuggestions.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981" }}>{i + 1}</span>
                      </div>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.instagram && (
              <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#E1306C,#F56040,#FCAF45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </div>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{profile.instagram}</span>
                </div>
                <a href={`https://instagram.com/${profile.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#10B981", fontWeight: 700, textDecoration: "none" }}>View →</a>
              </div>
            )}

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 32, lineHeight: 1.5 }}>
              Performance data generated by AI biomechanical analysis. For educational purposes only — not a medical diagnostic tool.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

// ── Exported page wrapped in Suspense (required for useSearchParams) ──────────
export default function AthletePublicProfile() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0A0F0D" }} />}>
      <AthleteProfileInner />
    </Suspense>
  );
}
