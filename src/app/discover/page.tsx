"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useProfile } from "@/contexts/ProfileContext";

// ── Demo athletes (seeded) ─────────────────────────────────────────────────────
const DEMO_ATHLETES = [
  {
    id: "demo1", name: "Sofia Martinez", age: 19, position: "Winger", secondaryPosition: "Attacking Mid",
    location: "Barcelona, Spain", nationality: "Spain", club: "FC Femení B", academicYear: "Sophomore",
    targetLeague: "Liga F", openToRecruitment: true, heightCm: 163, weightKg: 58,
    dominantFoot: "Left", yearsPlaying: 11, bio: "Electric pace on the flank with exceptional dribbling. Top scorer in my division last season.",
    peakSpeedMs: 8.6, symmetryScore: 92, sessions: 14, risk: "low",
    moves: ["Cruyff Turn","Stepover","Overlap Run","Diagonal Cut"],
    photo: "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?auto=format&fit=crop&w=200&q=80",
    goals: "18", assists: "11", appearances: "22",
  },
  {
    id: "demo2", name: "Amara Diallo", age: 21, position: "Midfielder", secondaryPosition: "Defensive Mid",
    location: "Paris, France", nationality: "France", club: "Paris FC Academy", academicYear: "Junior",
    targetLeague: "D1 Arkema", openToRecruitment: true, heightCm: 170, weightKg: 63,
    dominantFoot: "Right", yearsPlaying: 13, bio: "Deep-lying playmaker with exceptional vision and press resistance. Leadership on and off the pitch.",
    peakSpeedMs: 7.9, symmetryScore: 87, sessions: 9, risk: "low",
    moves: ["Wall Pass","Through Ball","Press Trigger","Box-to-Box Run"],
    photo: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80",
    goals: "5", assists: "19", appearances: "24",
  },
  {
    id: "demo3", name: "Chloe Nguyen", age: 17, position: "Striker", secondaryPosition: "Forward",
    location: "Los Angeles, CA", nationality: "USA", club: "LA Galaxy Academy", academicYear: "Freshman",
    targetLeague: "NWSL", openToRecruitment: true, heightCm: 168, weightKg: 62,
    dominantFoot: "Right", yearsPlaying: 9, bio: "Clinical finisher with explosive first touch. Strong aerial presence for my height.",
    peakSpeedMs: 8.1, symmetryScore: 84, sessions: 6, risk: "moderate",
    moves: ["First Touch Finish","Header","Spinning Turn","Late Run"],
    photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80",
    goals: "24", assists: "6", appearances: "18",
  },
  {
    id: "demo4", name: "Lena Braun", age: 20, position: "Center Back", secondaryPosition: "Full Back",
    location: "Munich, Germany", nationality: "Germany", club: "FC Bayern München II", academicYear: "Sophomore",
    targetLeague: "Frauen-Bundesliga", openToRecruitment: true, heightCm: 174, weightKg: 67,
    dominantFoot: "Right", yearsPlaying: 10, bio: "Dominant in the air and composed with the ball at my feet. Modern CB who can play out from the back.",
    peakSpeedMs: 7.4, symmetryScore: 89, sessions: 11, risk: "low",
    moves: ["Long Ball Switch","Stepping Out","Aerial Duel","Recovery Run"],
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    goals: "3", assists: "5", appearances: "20",
  },
  {
    id: "demo5", name: "Yuki Tanaka", age: 18, position: "Goalkeeper", secondaryPosition: "",
    location: "Tokyo, Japan", nationality: "Japan", club: "INAC Kobe Academy", academicYear: "Freshman",
    targetLeague: "WE League", openToRecruitment: true, heightCm: 172, weightKg: 66,
    dominantFoot: "Right", yearsPlaying: 8, bio: "Shot-stopper with elite reflexes. Comfortable sweeping outside the box and distributing with my feet.",
    peakSpeedMs: 6.8, symmetryScore: 91, sessions: 5, risk: "low",
    moves: ["Sweeper Keeper","Distribution","Command of Area","Penalty Stop"],
    photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=200&q=80",
    goals: "0", assists: "1", appearances: "19",
  },
  {
    id: "demo6", name: "Priya Kapoor", age: 22, position: "Full Back", secondaryPosition: "Winger",
    location: "Mumbai, India", nationality: "India", club: "Kickstart FC", academicYear: "Senior",
    targetLeague: "Indian Women's League", openToRecruitment: true, heightCm: 161, weightKg: 56,
    dominantFoot: "Both", yearsPlaying: 12, bio: "Attack-minded fullback known for overlapping runs and dangerous crosses. Strong defensive positioning.",
    peakSpeedMs: 8.3, symmetryScore: 88, sessions: 8, risk: "low",
    moves: ["Overlap Run","Cross","Tuck Inside","Recovery Sprint"],
    photo: "https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?auto=format&fit=crop&w=200&q=80",
    goals: "7", assists: "14", appearances: "21",
  },
  {
    id: "demo7", name: "Isabela Costa", age: 23, position: "Attacking Mid", secondaryPosition: "Winger",
    location: "São Paulo, Brazil", nationality: "Brazil", club: "Corinthians Feminino", academicYear: "Graduate",
    targetLeague: "Liga Profissional", openToRecruitment: false, heightCm: 165, weightKg: 60,
    dominantFoot: "Left", yearsPlaying: 15, bio: "Creative playmaker who dictates tempo. Known for key passes and set piece delivery.",
    peakSpeedMs: 7.7, symmetryScore: 85, sessions: 17, risk: "moderate",
    moves: ["No-Look Pass","Nutmeg","Free Kick","Dribble into Box"],
    photo: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=200&q=80",
    goals: "12", assists: "22", appearances: "27",
  },
  {
    id: "demo8", name: "Maya Thompson", age: 16, position: "Winger", secondaryPosition: "Forward",
    location: "London, UK", nationality: "England", club: "Arsenal Academy", academicYear: "Freshman",
    targetLeague: "WSL", openToRecruitment: true, heightCm: 160, weightKg: 55,
    dominantFoot: "Right", yearsPlaying: 7, bio: "Exciting young talent with incredible acceleration and direct style of play. England U17 national team squad.",
    peakSpeedMs: 8.9, symmetryScore: 82, sessions: 4, risk: "moderate",
    moves: ["Sprint in Behind","Cutback","1v1 Dribble","Acceleration"],
    photo: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=200&q=80",
    goals: "15", assists: "8", appearances: "14",
  },
];

const ALL_POSITIONS = ["All Positions", "Goalkeeper", "Center Back", "Full Back", "Midfielder",
  "Defensive Mid", "Attacking Mid", "Winger", "Forward", "Striker"];
const ALL_YEARS = ["All Years", "Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Professional"];

function riskColor(r: string) {
  if (r === "low") return "#10B981";
  if (r === "moderate") return "#FBBF24";
  return "#F87171";
}

type DemoAthlete = typeof DEMO_ATHLETES[number];

function AthleteCard({ athlete, onShortlist, shortlisted }: { athlete: DemoAthlete; onShortlist: () => void; shortlisted: boolean }) {
  return (
    <div style={{ background: "#141A17", border: shortlisted ? "1px solid rgba(5,150,105,0.4)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden", transition: "all 0.2s", position: "relative" }}>
      {shortlisted && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, background: "rgba(5,150,105,0.9)", borderRadius: 100, padding: "3px 8px", fontSize: 9, fontWeight: 800, color: "white", letterSpacing: "0.05em", textTransform: "uppercase" }}>Shortlisted</div>
      )}

      {/* Top section */}
      <div style={{ padding: "20px 20px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", flexShrink: 0, border: "2px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg,#059669,#0D9488)", position: "relative" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", inset: 0 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color: "white" }}>{athlete.name.charAt(0)}</span>
          </div>
          <img src={athlete.photo} alt={athlete.name} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{athlete.name}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(5,150,105,0.12)", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "2px 8px" }}>{athlete.position}</span>
            {athlete.openToRecruitment && (
              <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(251,191,36,0.1)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 100, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Recruiting</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { l: "Speed", v: athlete.peakSpeedMs ? `${athlete.peakSpeedMs} m/s` : "—", c: "#10B981" },
          { l: "Symmetry", v: `${athlete.symmetryScore}%`, c: "#06B6D4" },
          { l: "Risk", v: athlete.risk.charAt(0).toUpperCase() + athlete.risk.slice(1), c: riskColor(athlete.risk) },
        ].map(s => (
          <div key={s.l} style={{ padding: "12px 8px", textAlign: "center" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.l}</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div style={{ padding: "12px 20px 6px" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>📍 {athlete.location} · Age {athlete.age}</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>{athlete.club} · {athlete.academicYear} · {athlete.sessions} sessions</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: 12 }}>{athlete.bio.slice(0, 90)}{athlete.bio.length > 90 ? "…" : ""}</p>

        {/* Move pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
          {athlete.moves.slice(0, 3).map(m => (
            <span key={m} style={{ fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", borderRadius: 6, padding: "3px 8px" }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "0 20px 20px", display: "flex", gap: 8 }}>
        <button
          onClick={onShortlist}
          style={{ flex: 1, padding: "10px", borderRadius: 10, background: shortlisted ? "rgba(5,150,105,0.15)" : "transparent", border: `1px solid ${shortlisted ? "rgba(5,150,105,0.4)" : "rgba(255,255,255,0.1)"}`, color: shortlisted ? "#10B981" : "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>
          {shortlisted ? "★ Shortlisted" : "☆ Shortlist"}
        </button>
        <Link href={athlete.id === "current_user" ? "/athlete" : `/athlete?id=${athlete.id}`} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(5,150,105,0.25)" }}>
          View Profile →
        </Link>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const { profile } = useProfile();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("All Positions");
  const [academicYear, setAcademicYear] = useState("All Years");
  const [recruitOnly, setRecruitOnly] = useState(false);
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [showShortlistOnly, setShowShortlistOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"speed"|"symmetry"|"sessions">("speed");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    const saved = localStorage.getItem("kickiq_shortlist");
    if (saved) setShortlistIds(JSON.parse(saved));
  }, []);

  function toggleShortlist(id: string) {
    setShortlistIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem("kickiq_shortlist", JSON.stringify(next));
      return next;
    });
  }

  // Include current user if they're an athlete with a complete profile
  const currentUserAthlete = profile.name && profile.primaryPosition ? [{
    id: "current_user",
    name: profile.name,
    age: parseInt(profile.age) || 18,
    position: profile.primaryPosition,
    secondaryPosition: profile.secondaryPosition || "",
    location: profile.location || "Unknown",
    nationality: profile.nationality || "Unknown",
    club: profile.currentClub || "Independent",
    academicYear: profile.academicYear || "Freshman",
    targetLeague: profile.targetLeague || "",
    openToRecruitment: profile.openToRecruitment,
    heightCm: parseInt(profile.heightCm) || 170,
    weightKg: parseInt(profile.weightKg) || 65,
    dominantFoot: profile.dominantFoot || "Right",
    yearsPlaying: parseInt(profile.yearsPlaying) || 5,
    bio: profile.bio || `${profile.primaryPosition} looking for opportunities.`,
    peakSpeedMs: 7.5,
    symmetryScore: 85,
    sessions: 0,
    risk: "low" as const,
    moves: [],
    photo: profile.photoUrl || "",
    goals: profile.goals || "0",
    assists: profile.assists || "0",
    appearances: profile.appearances || "0",
  }] : [];

  const allAthletes = [...currentUserAthlete, ...DEMO_ATHLETES];

  const filtered = useMemo(() => {
    return allAthletes
      .filter(a => {
        if (showShortlistOnly && !shortlistIds.includes(a.id)) return false;
        if (recruitOnly && !a.openToRecruitment) return false;
        if (position !== "All Positions" && a.position !== position && a.secondaryPosition !== position) return false;
        if (academicYear !== "All Years" && a.academicYear !== academicYear) return false;
        if (search) {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || a.position.toLowerCase().includes(q) ||
            a.location.toLowerCase().includes(q) || a.club.toLowerCase().includes(q) ||
            a.nationality.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "speed") return (b.peakSpeedMs || 0) - (a.peakSpeedMs || 0);
        if (sortBy === "symmetry") return (b.symmetryScore || 0) - (a.symmetryScore || 0);
        return b.sessions - a.sessions;
      });
  }, [allAthletes, search, position, academicYear, recruitOnly, showShortlistOnly, shortlistIds, sortBy]);

  return (
    <main style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "var(--font-body)", color: "white" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(10,15,13,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "var(--font-display)" }}>K</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", letterSpacing: "0.1em" }}>KICKIQ</span>
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/profile" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textDecoration: "none", padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>My Dashboard</Link>
            <Link href="/athlete" style={{ fontSize: 13, fontWeight: 700, color: "white", textDecoration: "none", padding: "7px 16px", borderRadius: 8, background: "#059669" }}>My Profile</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 36, color: "white", marginBottom: 8 }}>Discover Athletes</h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>Browse AI-analyzed players open to recruitment</p>
        </div>

        {/* Search + filters */}
        <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px 24px", marginBottom: 28 }}>
          {/* Search bar */}
          <input
            type="search"
            placeholder="Search by name, position, club, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box" }}
          />

          {/* Filter row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <select
              value={position}
              onChange={e => setPosition(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "white", outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {ALL_POSITIONS.map(p => <option key={p} value={p} style={{ background: "#141A17" }}>{p}</option>)}
            </select>

            <select
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "white", outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {ALL_YEARS.map(y => <option key={y} value={y} style={{ background: "#141A17" }}>{y}</option>)}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "white", outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="speed" style={{ background: "#141A17" }}>Sort: Speed</option>
              <option value="symmetry" style={{ background: "#141A17" }}>Sort: Symmetry</option>
              <option value="sessions" style={{ background: "#141A17" }}>Sort: Sessions</option>
            </select>

            <button
              onClick={() => setRecruitOnly(p => !p)}
              style={{ padding: "9px 16px", borderRadius: 10, background: recruitOnly ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${recruitOnly ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`, color: recruitOnly ? "#10B981" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
              Open to Recruit
            </button>

            {shortlistIds.length > 0 && (
              <button
                onClick={() => setShowShortlistOnly(p => !p)}
                style={{ padding: "9px 16px", borderRadius: 10, background: showShortlistOnly ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${showShortlistOnly ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"}`, color: showShortlistOnly ? "#FBBF24" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                ★ Shortlist ({shortlistIds.length})
              </button>
            )}

            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>{filtered.length} athlete{filtered.length !== 1 ? "s" : ""} found</span>
          </div>
        </div>

        {/* Athlete grid */}
        {filtered.length === 0 ? (
          <div style={{ padding: "80px 24px", textAlign: "center", background: "#141A17", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18 }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "white", marginBottom: 10 }}>No athletes found</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Try adjusting your filters.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filtered.map(a => (
              <AthleteCard
                key={a.id}
                athlete={a}
                shortlisted={shortlistIds.includes(a.id)}
                onShortlist={() => toggleShortlist(a.id)}
              />
            ))}
          </div>
        )}

        {/* Recruiter tip */}
        <div style={{ marginTop: 40, padding: "20px 24px", background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.12)", borderRadius: 14, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 4 }}>AI-Powered Biomechanics</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>All performance data is generated by MediaPipe pose analysis and Claude AI. Speed, symmetry, and injury risk scores are derived from actual training footage — not self-reported stats.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
