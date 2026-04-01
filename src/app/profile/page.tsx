"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile, AthleteProfile, AnalysisSession } from "@/contexts/ProfileContext";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────
const AUTHED_KEY  = "kickiq_authed_email";
const THEME_KEY   = "kickiq_theme";
const POSITIONS = ["Goalkeeper","Defender","Center Back","Full Back","Midfielder",
  "Defensive Mid","Central Mid","Attacking Mid","Winger","Forward","Striker"];
const YEARS = ["Freshman","Sophomore","Junior","Senior","Graduate","Professional","Youth Academy"];
const CONV_KEY = "kickiq_conversations";

// ── Messaging types ───────────────────────────────────────────────────────────
type ChatMessage = { id: string; from: "me" | "them"; text: string; ts: string };
type Conversation = {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: "athlete" | "recruiter";
  participantInitial: string;
  unread: number;
  messages: ChatMessage[];
};

// ── Mock athletes (Scout Board seed data) ────────────────────────────────────
type MockAthlete = {
  id: string; name: string; age: number; position: string; club: string;
  location: string; peakSpeedMs: number; symmetryScore: number;
  overallRisk: "low" | "moderate" | "high"; nationality: string;
  heightCm: number; weightKg: number; photoInitial: string;
};
const MOCK_ATHLETES: MockAthlete[] = [
  { id: "ma1", name: "Diego Morales",   age: 19, position: "Winger",        club: "FC Valencia B",    location: "Valencia, ESP",    peakSpeedMs: 9.8,  symmetryScore: 87, overallRisk: "low",      nationality: "Spanish",    heightCm: 174, weightKg: 68, photoInitial: "D" },
  { id: "ma2", name: "Liam Okafor",     age: 20, position: "Striker",       club: "Ajax Academy",     location: "Amsterdam, NED",   peakSpeedMs: 9.3,  symmetryScore: 82, overallRisk: "low",      nationality: "Nigerian",   heightCm: 181, weightKg: 76, photoInitial: "L" },
  { id: "ma3", name: "Kenji Yamamoto",  age: 18, position: "Central Mid",   club: "Gamba Osaka U-18", location: "Osaka, JPN",       peakSpeedMs: 8.7,  symmetryScore: 91, overallRisk: "low",      nationality: "Japanese",   heightCm: 172, weightKg: 65, photoInitial: "K" },
  { id: "ma4", name: "Marco Esposito",  age: 21, position: "Defender",      club: "AS Roma Youth",    location: "Rome, ITA",        peakSpeedMs: 8.2,  symmetryScore: 78, overallRisk: "moderate", nationality: "Italian",    heightCm: 183, weightKg: 79, photoInitial: "M" },
  { id: "ma5", name: "Rasheed Al-Amri", age: 19, position: "Attacking Mid", club: "Al-Nassr U-21",    location: "Riyadh, KSA",      peakSpeedMs: 9.1,  symmetryScore: 85, overallRisk: "low",      nationality: "Saudi",      heightCm: 176, weightKg: 70, photoInitial: "R" },
  { id: "ma6", name: "Tyler Rousseau",  age: 22, position: "Goalkeeper",    club: "CF Montréal Res.",  location: "Montreal, CAN",    peakSpeedMs: 7.4,  symmetryScore: 80, overallRisk: "low",      nationality: "Canadian",   heightCm: 189, weightKg: 83, photoInitial: "T" },
  { id: "ma7", name: "Sofia Chen",      age: 20, position: "Defensive Mid", club: "Portland Thorns II",location: "Portland, USA",    peakSpeedMs: 8.5,  symmetryScore: 88, overallRisk: "low",      nationality: "American",   heightCm: 168, weightKg: 62, photoInitial: "S" },
  { id: "ma8", name: "Enzo Fernandez",  age: 21, position: "Forward",       club: "River Plate B",    location: "Buenos Aires, ARG",peakSpeedMs: 9.5,  symmetryScore: 74, overallRisk: "moderate", nationality: "Argentine",  heightCm: 179, weightKg: 74, photoInitial: "E" },
];

// ── Seed conversations ────────────────────────────────────────────────────────
function getOrSeedConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (raw) return JSON.parse(raw) as Conversation[];
    const seed: Conversation[] = [
      {
        id: "conv_001",
        participantId: "ma1",
        participantName: "Diego Morales",
        participantRole: "athlete",
        participantInitial: "D",
        unread: 1,
        messages: [
          { id: "m1", from: "them", text: "Hey! I saw your profile on KickIQ. I'm really interested in your program.", ts: new Date(Date.now() - 86400000 * 2).toISOString() },
          { id: "m2", from: "me",   text: "Hi Diego! Great to hear from you. Your speed numbers are impressive — 9.8 m/s peak.", ts: new Date(Date.now() - 86400000).toISOString() },
          { id: "m3", from: "them", text: "Thanks! I've been working hard on my acceleration this preseason.", ts: new Date(Date.now() - 3600000).toISOString() },
        ],
      },
      {
        id: "conv_002",
        participantId: "ma3",
        participantName: "Kenji Yamamoto",
        participantRole: "athlete",
        participantInitial: "K",
        unread: 0,
        messages: [
          { id: "m4", from: "them", text: "Coach, do you have time for a call this week? I want to discuss the scholarship options.", ts: new Date(Date.now() - 86400000 * 5).toISOString() },
          { id: "m5", from: "me",   text: "Absolutely, Kenji. How about Thursday at 3 PM your time?", ts: new Date(Date.now() - 86400000 * 4).toISOString() },
          { id: "m6", from: "them", text: "Perfect! I'll make sure to prepare some questions.", ts: new Date(Date.now() - 86400000 * 4 + 3600000).toISOString() },
        ],
      },
    ];
    localStorage.setItem(CONV_KEY, JSON.stringify(seed));
    return seed;
  } catch { return []; }
}

// ── Auto-reply generator ─────────────────────────────────────────────────────
function generateAutoReply(participantRole: "athlete" | "recruiter"): string {
  const athleteReplies = [
    "Thanks for reaching out! I'd love to learn more about your program.",
    "That's great to hear! I've been training really hard this season.",
    "Absolutely, I'd be happy to send over my highlight reel.",
    "Thanks coach! I've always dreamed of playing at that level.",
    "I appreciate the interest! When would be a good time to chat?",
  ];
  const recruiterReplies = [
    "Great question. I'll review your latest session footage before our call.",
    "We have some exciting opportunities available. Let's set up a time to talk.",
    "I'll get back to you with the full scholarship breakdown by end of week.",
    "Thanks for your interest! Our program is a great fit for your profile.",
    "I've shared your stats with our coaching staff. Very promising numbers.",
  ];
  const pool = participantRole === "athlete" ? athleteReplies : recruiterReplies;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function riskColor(l?: string) {
  if (l === "low")      return "#10B981";
  if (l === "moderate") return "#FBBF24";
  return "#F87171";
}
function riskLabel(l?: string) {
  if (l === "low")      return "Good";
  if (l === "moderate") return "Monitor";
  return "Attention";
}

// ── Session thumbnail pool (soccer action shots) ──────────────────────────────
const SESSION_THUMBS = [
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=900&q=80",
];

// ── Explore content ───────────────────────────────────────────────────────────
const EXPLORE = [
  { cat: "Training", title: "5 Speed Drills for Midfielders", source: "UEFA", url: "https://www.uefa.com/nationalassociations/uefaregulations/technicalreports/", img: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80" },
  { cat: "Fitness",  title: "Injury Prevention for Young Athletes", source: "FIFA", url: "https://www.fifa.com/technical/football-medicine/", img: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=400&q=80" },
  { cat: "Tactics",  title: "Pressing Triggers & High Press", source: "FC Barcelona", url: "https://www.fcbarcelona.com/en/football/first-team", img: "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=400&q=80" },
  { cat: "Nutrition","title": "Fueling Performance: Pre-Match Diet", source: "Sports Science", url: "https://www.gssiweb.org/sports-science-exchange/article/sse-180-fueling-for-sport", img: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=400&q=80" },
  { cat: "Recruiting","title":"How College Coaches Find Prospects", source: "NSCAA", url: "https://www.nscaa.com/resources/college-recruiting", img: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=400&q=80" },
  { cat: "Training", title: "Ball Mastery: 15-Min Daily Routine", source: "Coerver", url: "https://www.coerver.com/", img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&q=80" },
];

// ── Progress Charts Tab ────────────────────────────────────────────────────────
function ProgressTab({ sessions, isDark }: { sessions: AnalysisSession[]; isDark: boolean }) {
  const text1 = isDark ? "white" : "#0D1F17";
  const text2 = isDark ? "rgba(255,255,255,0.4)" : "#5A7268";
  const card  = isDark ? "#141A17" : "white";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(5,150,105,0.12)";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(5,150,105,0.08)";
  const axisColor = isDark ? "rgba(255,255,255,0.25)" : "#8AB5A3";

  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const speedData = sorted
    .filter(s => s.peakSpeedMs)
    .map((s, i) => ({
      session: i + 1,
      label: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      speed: parseFloat(s.peakSpeedMs!.toFixed(2)),
      mean: s.meanSpeedMs ? parseFloat(s.meanSpeedMs.toFixed(2)) : undefined,
    }));

  const symmetryData = sorted
    .filter(s => s.symmetryScore)
    .map((s, i) => ({
      session: i + 1,
      label: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      symmetry: parseFloat(s.symmetryScore!.toFixed(1)),
    }));

  const riskData = sorted
    .filter(s => s.overallRiskScore !== undefined)
    .map((s, i) => ({
      session: i + 1,
      label: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      risk: s.overallRiskScore,
      fill: s.overallRisk === "low" ? "#10B981" : s.overallRisk === "moderate" ? "#FBBF24" : "#F87171",
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: isDark ? "#1A2420" : "white", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ color: text2, marginBottom: 4, fontWeight: 700 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || "#10B981", fontWeight: 800 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  const avgSpeed = speedData.length ? (speedData.reduce((a, d) => a + d.speed, 0) / speedData.length).toFixed(2) : "—";
  const bestSpeed = speedData.length ? Math.max(...speedData.map(d => d.speed)).toFixed(2) : "—";
  const avgSym = symmetryData.length ? (symmetryData.reduce((a, d) => a + d.symmetry, 0) / symmetryData.length).toFixed(1) : "—";
  const latestRisk = riskData.length ? riskData[riskData.length - 1] : null;

  if (sessions.length === 0) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", background: card, border: `1px solid ${border}`, borderRadius: 18 }}>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: text1, marginBottom: 10 }}>No data yet</p>
        <p style={{ color: text2, fontSize: 15 }}>Upload sessions to see your progress charts.</p>
        <Link href="/analyze" style={{ display: "inline-block", marginTop: 24, padding: "14px 32px", borderRadius: 14, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Analyze First Video →</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Best Speed", value: `${bestSpeed} m/s`, sub: "peak recorded", color: "#10B981" },
          { label: "Avg Speed", value: `${avgSpeed} m/s`, sub: "across sessions", color: "#34D399" },
          { label: "Avg Symmetry", value: `${avgSym}%`, sub: "balance score", color: "#06B6D4" },
          { label: "Sessions", value: String(sessions.length), sub: "total analyzed", color: "#A78BFA" },
          ...(latestRisk ? [{ label: "Latest Risk", value: latestRisk.fill === "#10B981" ? "Low" : latestRisk.fill === "#FBBF24" ? "Moderate" : "High", sub: "injury risk", color: latestRisk.fill as string }] : []),
        ].map(d => (
          <div key={d.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "18px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{d.label}</p>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: d.color, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.value}</p>
            <p style={{ fontSize: 11, color: text2, marginTop: 6 }}>{d.sub}</p>
          </div>
        ))}
      </div>

      {/* Speed trend */}
      {speedData.length >= 2 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: "24px 24px 16px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: text1, marginBottom: 4 }}>Speed Over Time</p>
          <p style={{ fontSize: 12, color: text2, marginBottom: 20 }}>Peak and mean sprint speed across sessions (m/s)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={speedData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="speed" name="Peak Speed" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 4 }} activeDot={{ r: 6 }} />
              {speedData.some(d => d.mean) && (
                <Line type="monotone" dataKey="mean" name="Mean Speed" stroke="#34D399" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Symmetry trend */}
      {symmetryData.length >= 2 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: "24px 24px 16px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: text1, marginBottom: 4 }}>Body Symmetry</p>
          <p style={{ fontSize: 12, color: text2, marginBottom: 20 }}>Left/right balance score — higher is better (%)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={symmetryData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="symGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[50, 100]} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Area type="monotone" dataKey="symmetry" name="Symmetry" stroke="#06B6D4" fill="url(#symGrad)" strokeWidth={2.5} dot={{ fill: "#06B6D4", r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Risk trend */}
      {riskData.length >= 2 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: "24px 24px 16px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: text1, marginBottom: 4 }}>Injury Risk Score</p>
          <p style={{ fontSize: 12, color: text2, marginBottom: 20 }}>AI-assessed risk per session — lower is better</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {riskData.map((d, i) => null)}
              <Bar dataKey="risk" name="Risk Score" radius={[6, 6, 0, 0]}>
                {riskData.map((d, i) => (
                  <rect key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
            {[["#10B981", "Low"], ["#FBBF24", "Moderate"], ["#F87171", "High"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11, color: text2, fontWeight: 600 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 1 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "20px 24px", textAlign: "center" }}>
          <p style={{ color: text2, fontSize: 14 }}>Add more sessions to see your progress charts and trends.</p>
        </div>
      )}
    </div>
  );
}

// ── Compare Modal ──────────────────────────────────────────────────────────────
function CompareModal({ sessions, compareIds, onClose }: {
  sessions: AnalysisSession[]; compareIds: string[]; onClose: () => void;
}) {
  const a = sessions.find(s => s.id === compareIds[0]);
  const b = sessions.find(s => s.id === compareIds[1]);
  if (!a || !b) return null;

  const rows = [
    { label: "Date",           vA: new Date(a.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}), vB: new Date(b.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}), better: null },
    { label: "Peak Speed",     vA: a.peakSpeedMs ? `${a.peakSpeedMs.toFixed(2)} m/s` : "—", vB: b.peakSpeedMs ? `${b.peakSpeedMs.toFixed(2)} m/s` : "—", better: (a.peakSpeedMs ?? 0) > (b.peakSpeedMs ?? 0) ? "A" : (b.peakSpeedMs ?? 0) > (a.peakSpeedMs ?? 0) ? "B" : null },
    { label: "Mean Speed",     vA: a.meanSpeedMs ? `${a.meanSpeedMs.toFixed(2)} m/s` : "—", vB: b.meanSpeedMs ? `${b.meanSpeedMs.toFixed(2)} m/s` : "—", better: (a.meanSpeedMs ?? 0) > (b.meanSpeedMs ?? 0) ? "A" : (b.meanSpeedMs ?? 0) > (a.meanSpeedMs ?? 0) ? "B" : null },
    { label: "Stride Count",   vA: a.strideCount ? String(a.strideCount) : "—", vB: b.strideCount ? String(b.strideCount) : "—", better: null },
    { label: "Symmetry Score", vA: a.symmetryScore ? `${a.symmetryScore.toFixed(1)}%` : "—", vB: b.symmetryScore ? `${b.symmetryScore.toFixed(1)}%` : "—", better: (a.symmetryScore ?? 0) > (b.symmetryScore ?? 0) ? "A" : (b.symmetryScore ?? 0) > (a.symmetryScore ?? 0) ? "B" : null },
    { label: "Peak Torque",    vA: a.peakTorqueNm ? `${a.peakTorqueNm.toFixed(0)} Nm` : "—", vB: b.peakTorqueNm ? `${b.peakTorqueNm.toFixed(0)} Nm` : "—", better: (a.peakTorqueNm ?? 0) > (b.peakTorqueNm ?? 0) ? "A" : (b.peakTorqueNm ?? 0) > (a.peakTorqueNm ?? 0) ? "B" : null },
    { label: "Injury Risk",    vA: a.overallRisk ? a.overallRisk.charAt(0).toUpperCase() + a.overallRisk.slice(1) : "—", vB: b.overallRisk ? b.overallRisk.charAt(0).toUpperCase() + b.overallRisk.slice(1) : "—", better: a.overallRisk === "low" && b.overallRisk !== "low" ? "A" : b.overallRisk === "low" && a.overallRisk !== "low" ? "B" : null },
    { label: "Duration",       vA: `${a.videoDuration.toFixed(0)}s`, vB: `${b.videoDuration.toFixed(0)}s`, better: null },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 720, maxHeight: "90vh", overflow: "auto", background: "#111816", borderRadius: 24, boxShadow: "0 40px 100px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ padding: "22px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "white" }}>Session Comparison</p>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 15 }}>✕</button>
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ padding: "14px 20px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Metric</p>
          </div>
          {[a, b].map((s, i) => (
            <div key={s.id} style={{ padding: "14px 20px", background: i === 0 ? "rgba(5,150,105,0.06)" : "rgba(6,182,212,0.06)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? "#10B981" : "#06B6D4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Session {i + 1}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.videoName}</p>
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
            <div style={{ padding: "13px 20px" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{row.label}</p>
            </div>
            {[{ v: row.vA, win: row.better === "A" }, { v: row.vB, win: row.better === "B" }].map((cell, j) => (
              <div key={j} style={{ padding: "13px 20px", borderLeft: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: cell.win ? "#10B981" : "rgba(255,255,255,0.75)" }}>{cell.v}</p>
                {cell.win && <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 100, padding: "2px 7px", letterSpacing: "0.04em" }}>BETTER</span>}
              </div>
            ))}
          </div>
        ))}

        {/* AI summaries */}
        {(a.geminiSummary || b.geminiSummary) && (
          <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[a, b].map((s, i) => s.geminiSummary ? (
              <div key={s.id} style={{ background: i === 0 ? "rgba(5,150,105,0.07)" : "rgba(6,182,212,0.07)", border: `1px solid ${i === 0 ? "rgba(5,150,105,0.18)" : "rgba(6,182,212,0.18)"}`, borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? "#10B981" : "#06B6D4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>AI Analysis</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{s.geminiSummary.slice(0, 220)}{s.geminiSummary.length > 220 ? "…" : ""}</p>
              </div>
            ) : <div key={s.id} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session scrub card ─────────────────────────────────────────────────────────
function SessionCard({ session, onRemove, pinned, onPin, selected, onSelect }: {
  session: AnalysisSession; onRemove: () => void; pinned: boolean; onPin: () => void;
  selected?: boolean; onSelect?: () => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [scrub,  setScrub]  = useState<number | null>(null);

  const ts      = session.kinematics?.timestamp_ms ?? [];
  const frame   = scrub !== null ? Math.round((scrub / 100) * Math.max(ts.length - 1, 0)) : null;
  const frameT  = frame !== null ? (ts[frame] ?? 0) / 1000 : null;
  const frameSpd= frame !== null ? (session.kinematics?.ankle_speed_ms?.[frame] ?? null) : null;
  const frameLK = frame !== null ? (session.kinematics?.left_knee_angle_deg?.[frame] ?? null) : null;
  const frameRK = frame !== null ? (session.kinematics?.right_knee_angle_deg?.[frame] ?? null) : null;
  const rc      = { color: riskColor(session.overallRisk), label: riskLabel(session.overallRisk) };
  const date    = new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ background: "#141A17", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden", transition: "all 0.2s" }}>
      {/* Card header — always visible */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px 18px", cursor: "pointer", display: "flex", gap: 14, alignItems: "center" }}>
        {/* Compare checkbox */}
        {onSelect && (
          <div onClick={e => { e.stopPropagation(); onSelect(); }} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected ? "#059669" : "rgba(255,255,255,0.15)"}`, background: selected ? "#059669" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        )}
        {/* Video icon */}
        <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#0B2A1A,#0B1F3A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "white", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.videoName}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{date} · {session.videoDuration.toFixed(0)}s</p>
        </div>
        {/* Stat pills */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {session.peakSpeedMs && <span style={{ fontSize: 12, fontWeight: 800, color: "#10B981" }}>{session.peakSpeedMs.toFixed(1)} <span style={{ fontSize: 10, opacity: 0.6 }}>m/s</span></span>}
          {session.overallRisk && <span style={{ fontSize: 10, fontWeight: 800, color: rc.color, background: `${rc.color}18`, border: `1px solid ${rc.color}40`, borderRadius: 20, padding: "3px 8px" }}>{rc.label}</span>}
          {/* Pin button */}
          <button onClick={e => { e.stopPropagation(); onPin(); }} style={{ width: 28, height: 28, borderRadius: "50%", background: pinned ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${pinned ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", color: pinned ? "#FBBF24" : "rgba(255,255,255,0.25)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.2)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <span style={{ color: open ? "#10B981" : "rgba(255,255,255,0.2)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 18px" }}>
          {/* Mini stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Time", v: scrub !== null && frameT !== null ? `${frameT.toFixed(1)}s` : `${session.videoDuration.toFixed(0)}s` },
              { l: "Speed", v: scrub !== null && frameSpd !== null ? `${frameSpd.toFixed(1)} m/s` : session.peakSpeedMs ? `${session.peakSpeedMs.toFixed(1)} m/s` : "—" },
              { l: "L.Knee", v: scrub !== null && frameLK !== null ? `${frameLK.toFixed(0)}°` : "—" },
              { l: "R.Knee", v: scrub !== null && frameRK !== null ? `${frameRK.toFixed(0)}°` : "—" },
            ].map(d => (
              <div key={d.l} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{d.l}</p>
                <p style={{ fontSize: 13, color: scrub !== null ? "#10B981" : "rgba(255,255,255,0.7)", fontWeight: 800 }}>{d.v}</p>
              </div>
            ))}
          </div>

          {/* Scrub timeline */}
          {ts.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <input type="range" min={0} max={100} step={0.5} value={scrub ?? 100}
                onChange={e => setScrub(parseFloat(e.target.value) >= 99.5 ? null : parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#059669" }} />
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 2 }}>Drag to scrub through session data</p>
            </div>
          )}

          {/* AI summary */}
          {session.geminiSummary && (
            <details style={{ background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.18)", borderRadius: 12, padding: "12px 14px" }}>
              <summary style={{ fontSize: 12, color: "#10B981", fontWeight: 700, cursor: "pointer", listStyle: "none" }}>
                AI Analysis ▼
              </summary>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginTop: 8 }}>{session.geminiSummary}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── Messaging Panel ──────────────────────────────────────────────────────────
function MessagingPanel({
  isDark, bg, card, border, text1, text2,
  activeMsgConvId, setActiveMsgConvId,
  openWithAthleteId,
  isRecruiter,
}: {
  isDark: boolean; bg: string; card: string; border: string; text1: string; text2: string;
  activeMsgConvId: string | null; setActiveMsgConvId: (id: string | null) => void;
  openWithAthleteId: string | null;
  isRecruiter: boolean;
}) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load/seed conversations
  useEffect(() => {
    setConvs(getOrSeedConversations());
  }, []);

  // If openWithAthleteId is set, open or create that conversation
  useEffect(() => {
    if (!openWithAthleteId) return;
    setConvs(prev => {
      const existing = prev.find(c => c.participantId === openWithAthleteId);
      if (existing) {
        setActiveMsgConvId(existing.id);
        return prev;
      }
      const athlete = MOCK_ATHLETES.find(a => a.id === openWithAthleteId);
      if (!athlete) return prev;
      const newConv: Conversation = {
        id: `conv_${Date.now()}`,
        participantId: athlete.id,
        participantName: athlete.name,
        participantRole: "athlete",
        participantInitial: athlete.photoInitial,
        unread: 0,
        messages: [],
      };
      const updated = [newConv, ...prev];
      try { localStorage.setItem(CONV_KEY, JSON.stringify(updated)); } catch {}
      setActiveMsgConvId(newConv.id);
      return updated;
    });
  }, [openWithAthleteId]);

  // Scroll to bottom when active conv changes or messages added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMsgConvId, convs]);

  function persistConvs(updated: Conversation[]) {
    try { localStorage.setItem(CONV_KEY, JSON.stringify(updated)); } catch {}
    setConvs(updated);
  }

  function sendMessage() {
    if (!input.trim() || !activeMsgConvId) return;
    const msg: ChatMessage = { id: `m_${Date.now()}`, from: "me", text: input.trim(), ts: new Date().toISOString() };
    const updated = convs.map(c => c.id === activeMsgConvId
      ? { ...c, messages: [...c.messages, msg], unread: 0 }
      : c
    );
    persistConvs(updated);
    setInput("");
    // Auto-reply
    const conv = updated.find(c => c.id === activeMsgConvId);
    if (!conv) return;
    const role = conv.participantRole;
    setTimeout(() => {
      const reply: ChatMessage = { id: `m_${Date.now()}_r`, from: "them", text: generateAutoReply(role), ts: new Date().toISOString() };
      setConvs(prev => {
        const u = prev.map(c => c.id === activeMsgConvId
          ? { ...c, messages: [...c.messages, reply] }
          : c
        );
        try { localStorage.setItem(CONV_KEY, JSON.stringify(u)); } catch {}
        return u;
      });
    }, 1500);
  }

  function startNewConv(athlete: MockAthlete) {
    setNewMsgOpen(false);
    setConvs(prev => {
      const existing = prev.find(c => c.participantId === athlete.id);
      if (existing) { setActiveMsgConvId(existing.id); return prev; }
      const newConv: Conversation = {
        id: `conv_${Date.now()}`,
        participantId: athlete.id,
        participantName: athlete.name,
        participantRole: "athlete",
        participantInitial: athlete.photoInitial,
        unread: 0,
        messages: [],
      };
      const updated = [newConv, ...prev];
      try { localStorage.setItem(CONV_KEY, JSON.stringify(updated)); } catch {}
      setActiveMsgConvId(newConv.id);
      return updated;
    });
  }

  function markRead(convId: string) {
    setConvs(prev => {
      const u = prev.map(c => c.id === convId ? { ...c, unread: 0 } : c);
      try { localStorage.setItem(CONV_KEY, JSON.stringify(u)); } catch {}
      return u;
    });
  }

  const filtered = convs.filter(c => c.participantName.toLowerCase().includes(search.toLowerCase()));
  const activeConv = convs.find(c => c.id === activeMsgConvId) ?? null;

  function fmtTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return "now";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 200px)", minHeight: 500, background: card, border: `1px solid ${border}`, borderRadius: 18, overflow: "hidden" }}>
      {/* Left panel — conversation list */}
      <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: text1 }}>Messages</p>
            {isRecruiter && (
              <button onClick={() => setNewMsgOpen(true)} style={{ padding: "5px 12px", borderRadius: 20, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ New</button>
            )}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            style={{ width: "100%", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.06)", border: `1px solid ${border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: text1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>
        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <p style={{ color: text2, fontSize: 13 }}>No conversations yet.</p>
            </div>
          )}
          {filtered.map((conv, i) => {
            const last = conv.messages[conv.messages.length - 1];
            const isActive = activeMsgConvId === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => { setActiveMsgConvId(conv.id); markRead(conv.id); }}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "12px 16px", background: isActive ? (isDark ? "rgba(5,150,105,0.12)" : "#F0FDF9") : "none", border: "none", borderTop: i > 0 ? `1px solid ${border}` : "none", cursor: "pointer", textAlign: "left", transition: "background 0.12s" }}
              >
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "white", fontWeight: 800, fontSize: 15, fontFamily: "var(--font-display)" }}>{conv.participantInitial}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#10B981" : text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.participantName}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      {last && <span style={{ fontSize: 10, color: text2 }}>{fmtTime(last.ts)}</span>}
                      {conv.unread > 0 && <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#059669", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{conv.unread}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, background: conv.participantRole === "athlete" ? "rgba(5,150,105,0.12)" : "rgba(13,148,136,0.12)", color: conv.participantRole === "athlete" ? "#10B981" : "#0D9488", border: `1px solid ${conv.participantRole === "athlete" ? "rgba(5,150,105,0.25)" : "rgba(13,148,136,0.25)"}`, borderRadius: 100, padding: "1px 6px", textTransform: "capitalize" }}>{conv.participantRole}</span>
                    {last && <p style={{ fontSize: 11, color: text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.from === "me" ? "You: " : ""}{last.text.slice(0, 40)}{last.text.length > 40 ? "…" : ""}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel — chat view */}
      {activeConv ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "white", fontWeight: 800, fontSize: 13, fontFamily: "var(--font-display)" }}>{activeConv.participantInitial}</span>
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: text1 }}>{activeConv.participantName}</p>
              <span style={{ fontSize: 9, fontWeight: 700, background: activeConv.participantRole === "athlete" ? "rgba(5,150,105,0.12)" : "rgba(13,148,136,0.12)", color: activeConv.participantRole === "athlete" ? "#10B981" : "#0D9488", border: `1px solid ${activeConv.participantRole === "athlete" ? "rgba(5,150,105,0.25)" : "rgba(13,148,136,0.25)"}`, borderRadius: 100, padding: "1px 7px", textTransform: "capitalize" }}>{activeConv.participantRole}</span>
            </div>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {activeConv.messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center" }}>
                <p style={{ color: text2, fontSize: 13 }}>No messages yet. Say hello!</p>
              </div>
            )}
            {activeConv.messages.map(msg => (
              <div key={msg.id} style={{ display: "flex", justifyContent: msg.from === "me" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "72%", padding: "10px 14px", borderRadius: msg.from === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "me" ? "linear-gradient(135deg,#059669,#0D9488)" : (isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6"), border: msg.from === "me" ? "none" : `1px solid ${border}` }}>
                  <p style={{ fontSize: 13, color: msg.from === "me" ? "white" : text1, lineHeight: 1.5 }}>{msg.text}</p>
                  <p style={{ fontSize: 9, color: msg.from === "me" ? "rgba(255,255,255,0.55)" : text2, marginTop: 4, textAlign: "right" }}>{fmtTime(msg.ts)}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {/* Input bar */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${border}`, display: "flex", gap: 10 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message..."
              style={{ flex: 1, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.06)", border: `1px solid ${border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: text1, outline: "none", fontFamily: "inherit" }}
            />
            <button onClick={sendMessage} style={{ padding: "10px 18px", borderRadius: 12, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Send</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p style={{ fontWeight: 700, fontSize: 16, color: text1, marginBottom: 6 }}>Select a conversation</p>
            <p style={{ color: text2, fontSize: 13 }}>Choose from the left or start a new message.</p>
          </div>
        </div>
      )}

      {/* New message modal (recruiter only) */}
      {newMsgOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={() => setNewMsgOpen(false)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 480, maxHeight: "70vh", overflow: "auto", background: isDark ? "#111816" : "white", borderRadius: 20, boxShadow: "0 40px 100px rgba(0,0,0,0.5)", border: `1px solid ${border}` }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1 }}>Message an Athlete</p>
              <button onClick={() => setNewMsgOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: isDark ? "rgba(255,255,255,0.07)" : "#F3F4F6", border: "none", cursor: "pointer", color: text2, fontSize: 14 }}>✕</button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {MOCK_ATHLETES.map(a => (
                <button key={a.id} onClick={() => startNewConv(a)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "none", border: `1px solid ${border}`, cursor: "pointer", textAlign: "left", transition: "background 0.12s" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "white", fontWeight: 800, fontSize: 13 }}>{a.photoInitial}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: text1 }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: text2 }}>{a.position} · {a.club}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit Modal (for profile settings tab) ─────────────────────────────────────
function EditModal({ onClose }: { onClose: () => void }) {
  const { profile, setProfile } = useProfile();
  const [tab, setTab] = useState<"personal"|"soccer"|"injuries">("personal");
  const fileRef = useRef<HTMLInputElement>(null);
  const [newInj, setNewInj] = useState({ type: "", date: "", status: "recovered" as const, notes: "" });

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setProfile({ photoUrl: r.result as string });
    r.readAsDataURL(f);
  }

  const iStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
  const reqStyle: React.CSSProperties = { ...lStyle, color: "rgba(52,211,153,0.7)" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#111816", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "white" }}>Edit Profile</p>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 15 }}>✕</button>
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {(["personal","soccer","injuries"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "14px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: "none", border: "none", textTransform: "capitalize", color: tab === t ? "#10B981" : "rgba(255,255,255,0.3)", borderBottom: tab === t ? "2px solid #059669" : "2px solid transparent" }}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 28, background: "#111816" }}>
          {tab === "personal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div onClick={() => fileRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 20, border: "2px dashed rgba(255,255,255,0.15)", cursor: "pointer", overflow: "hidden", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {profile.photoUrl ? <img src={profile.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "white" }}>Profile Photo</p>
                  <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", cursor: "pointer", color: "#10B981", fontSize: 13, fontWeight: 600, padding: 0, marginTop: 4 }}>Upload photo →</button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[{k:"name",l:"Full Name",p:"Alex Johnson",req:true},{k:"age",l:"Age",p:"18",t:"number",req:true},{k:"nationality",l:"Nationality",p:"USA"},{k:"location",l:"City / Country",p:"Los Angeles, CA"}].map(f => (
                  <div key={f.k}>
                    <label style={f.req ? reqStyle : lStyle}>{f.l}{f.req && <span style={{color:"#10B981"}}> *</span>}</label>
                    <input style={iStyle} type={(f as any).t||"text"} value={profile[f.k as keyof AthleteProfile] as string||""} onChange={e=>setProfile({[f.k]:e.target.value} as any)} placeholder={f.p} />
                  </div>
                ))}
              </div>
              <div><label style={lStyle}>Bio</label><textarea style={{...iStyle, resize: "none"}} rows={3} value={profile.bio||""} onChange={e=>setProfile({bio:e.target.value})} placeholder="Tell coaches about yourself..." /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lStyle}>Email</label><input style={iStyle} type="email" value={profile.email||""} onChange={e=>setProfile({email:e.target.value})} placeholder="your@email.com"/></div>
                <div><label style={lStyle}>Instagram</label><input style={iStyle} value={profile.instagram||""} onChange={e=>setProfile({instagram:e.target.value})} placeholder="@handle"/></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "white" }}>Open to Recruitment</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Visible to college coaches and scouts</p>
                </div>
                <button type="button" onClick={() => setProfile({ openToRecruitment: !profile.openToRecruitment })}
                  style={{ position: "relative", width: 52, height: 30, borderRadius: 15, border: "none", cursor: "pointer", background: profile.openToRecruitment ? "#059669" : "rgba(255,255,255,0.1)", transition: "background 0.2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: profile.openToRecruitment ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "white", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                </button>
              </div>
            </div>
          )}
          {tab === "soccer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lStyle}>Primary Position</label><select style={{...iStyle,cursor:"pointer"}} value={profile.primaryPosition||""} onChange={e=>setProfile({primaryPosition:e.target.value})}><option value="">Select…</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label style={lStyle}>Secondary Position</label><select style={{...iStyle,cursor:"pointer"}} value={profile.secondaryPosition||""} onChange={e=>setProfile({secondaryPosition:e.target.value})}><option value="">Select…</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label style={lStyle}>Current Club</label><input style={iStyle} value={profile.currentClub||""} onChange={e=>setProfile({currentClub:e.target.value})} placeholder="FC United"/></div>
                <div><label style={lStyle}>Years Playing</label><input style={iStyle} type="number" value={profile.yearsPlaying||""} onChange={e=>setProfile({yearsPlaying:e.target.value})} placeholder="8"/></div>
                <div><label style={reqStyle}>Height (cm) <span style={{color:"#10B981"}}>*</span></label><input style={iStyle} type="number" value={profile.heightCm||""} onChange={e=>setProfile({heightCm:e.target.value})} placeholder="175" required /></div>
                <div><label style={reqStyle}>Weight (kg) <span style={{color:"#10B981"}}>*</span></label><input style={iStyle} type="number" value={profile.weightKg||""} onChange={e=>setProfile({weightKg:e.target.value})} placeholder="70" required /></div>
                <div><label style={lStyle}>Academic Year</label><select style={{...iStyle,cursor:"pointer"}} value={profile.academicYear||""} onChange={e=>setProfile({academicYear:e.target.value})}><option value="">Select…</option>{YEARS.map(y=><option key={y}>{y}</option>)}</select></div>
                <div><label style={lStyle}>GPA (optional)</label><input style={iStyle} value={profile.gpa||""} onChange={e=>setProfile({gpa:e.target.value})} placeholder="3.8"/></div>
              </div>
            </div>
          )}
          {tab === "injuries" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!(profile.injuries?.length) && <div style={{ textAlign: "center", padding: "32px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}><p style={{ color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>No injuries recorded</p></div>}
              {(profile.injuries||[]).map(inj => (
                <div key={inj.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div><p style={{ fontWeight: 700, color: "white" }}>{inj.type}</p><p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{new Date(inj.date).toLocaleDateString()}</p></div>
                  <button onClick={() => setProfile({injuries:profile.injuries.filter(i=>i.id!==inj.id)})} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", fontSize: 16 }}>✕</button>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 20 }}>
                <label style={lStyle}>Add Injury</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input style={iStyle} value={newInj.type} onChange={e=>setNewInj(p=>({...p,type:e.target.value}))} placeholder="e.g. Hamstring strain"/>
                  <input style={iStyle} type="date" value={newInj.date} onChange={e=>setNewInj(p=>({...p,date:e.target.value}))}/>
                </div>
                <button onClick={() => { if(!newInj.type||!newInj.date) return; setProfile({injuries:[...(profile.injuries||[]),{id:Date.now().toString(),...newInj}]}); setNewInj({type:"",date:"",status:"recovered",notes:""}); }} style={{ width:"100%", padding:"12px 0", borderRadius:12, background:"rgba(5,150,105,0.15)", border:"1px solid rgba(5,150,105,0.3)", color:"#10B981", fontWeight:700, cursor:"pointer", fontSize:14 }}>+ Add Record</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0E1410" }}>
          <button onClick={onClose} style={{ width:"100%", padding:"15px 0", borderRadius:14, fontSize:16, fontFamily:"var(--font-display)", fontWeight:700, background:"linear-gradient(135deg,#059669,#0D9488)", color:"white", border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(5,150,105,0.35)" }}>Save Profile</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { profile, sessions, removeSession, profileComplete, setProfile } = useProfile();
  const [activeTab,  setActiveTab]  = useState<string>("performance");
  const [editOpen,   setEditOpen]   = useState(false);
  const [pinnedIds,  setPinnedIds]  = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [isDark,     setIsDark]     = useState(true);
  const [meOpen,     setMeOpen]     = useState(false);
  const [watchlist,  setWatchlist]  = useState<string[]>([]);
  const [activeMsgConvId, setActiveMsgConvId] = useState<string | null>(null);
  const [msgOpenWithAthlete, setMsgOpenWithAthlete] = useState<string | null>(null);
  const router = useRouter();

  // Auth guard + default to light mode
  useEffect(() => {
    if (!sessionStorage.getItem(AUTHED_KEY)) { router.replace("/login"); return; }
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setIsDark(true);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(THEME_KEY, "light");
      setIsDark(false);
    }
    const pins = localStorage.getItem("kickiq_pinned");
    if (pins) setPinnedIds(JSON.parse(pins));
    const wl = localStorage.getItem("kickiq_watchlist");
    if (wl) setWatchlist(JSON.parse(wl));
  }, []);

  // When recruiter mode activates, default to scout-board tab
  useEffect(() => {
    if ((profile as any).accountType === "recruiter") {
      setActiveTab(prev => (["performance","progress","explore"].includes(prev) ? "scout-board" : prev));
    } else {
      setActiveTab(prev => (["scout-board","watchlist","messages-rec"].includes(prev) ? "performance" : prev));
    }
  }, [(profile as any).accountType]);

  function toggleWatchlist(id: string) {
    setWatchlist(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      try { localStorage.setItem("kickiq_watchlist", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function openMessageWith(athleteId: string) {
    setMsgOpenWithAthlete(null);  // reset first so effect re-fires if same athlete clicked again
    setTimeout(() => {
      setMsgOpenWithAthlete(athleteId);
      setActiveTab("messages-rec");
    }, 0);
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) { document.documentElement.setAttribute("data-theme", "dark"); localStorage.setItem(THEME_KEY, "dark"); }
    else      { document.documentElement.removeAttribute("data-theme");       localStorage.setItem(THEME_KEY, "light"); }
  }

  function togglePin(id: string) {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : prev.length >= 3 ? prev : [...prev, id];
      localStorage.setItem("kickiq_pinned", JSON.stringify(next));
      return next;
    });
  }

  function toggleCompare(id: string) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]
    );
  }

  // Derived stats
  const allSpeeds   = sessions.filter(s => s.peakSpeedMs).map(s => s.peakSpeedMs!);
  const bestSpeed   = allSpeeds.length ? Math.max(...allSpeeds) : null;
  const avgSymmetry = sessions.filter(s => s.symmetryScore).length
    ? sessions.filter(s => s.symmetryScore).reduce((a, s) => a + s.symmetryScore!, 0) / sessions.filter(s => s.symmetryScore).length
    : null;

  // Top Moments: best one per category across ALL sessions
  const allHighlights = sessions.flatMap(s => (s.highlights || []).map(h => ({ ...h, sessionName: s.videoName })));
  const topMoments: typeof allHighlights = [];
  const seenLabels = new Set<string>();
  allHighlights.forEach(h => { if (!seenLabels.has(h.label)) { seenLabels.add(h.label); topMoments.push(h); } });

  // All unique moves (short list)
  const allMoves = Array.from(new Set(sessions.flatMap(s => s.movesIdentified || []))).slice(0, 8);

  // Pinned sessions
  const pinnedSessions = sessions.filter(s => pinnedIds.includes(s.id));

  // Account type
  const isRecruiter = (profile as any).accountType === "recruiter";

  const bg = isDark ? "#0A0F0D" : "#F4FBF8";
  const card = isDark ? "#141A17" : "white";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(5,150,105,0.12)";
  const text1 = isDark ? "white" : "#0D1F17";
  const text2 = isDark ? "rgba(255,255,255,0.4)" : "#5A7268";

  return (
    <main style={{ minHeight: "100vh", background: bg, fontFamily: "var(--font-body)", transition: "background 0.3s" }}>
      {editOpen && <EditModal onClose={() => setEditOpen(false)} />}
      {compareOpen && compareIds.length === 2 && (
        <CompareModal sessions={sessions} compareIds={compareIds} onClose={() => setCompareOpen(false)} />
      )}

      {/* Compare floating bar */}
      {compareIds.length > 0 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 40, display: "flex", alignItems: "center", gap: 12, background: isDark ? "#1A2420" : "white", border: "1px solid rgba(5,150,105,0.35)", borderRadius: 100, padding: "10px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: text2 }}>{compareIds.length === 1 ? "Select 1 more session to compare" : "2 sessions selected"}</span>
          {compareIds.length === 2 && (
            <button onClick={() => setCompareOpen(true)} style={{ padding: "8px 18px", borderRadius: 100, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Compare →</button>
          )}
          <button onClick={() => setCompareIds([])} style={{ padding: "6px 12px", borderRadius: 100, background: "transparent", border: "none", cursor: "pointer", color: text2, fontSize: 12, fontWeight: 600 }}>Clear</button>
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: isDark ? "rgba(10,15,13,0.92)" : "rgba(244,251,248,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center" }}>
          {/* Logo */}
          <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: "auto" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "var(--font-display)" }}>K</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: text1, letterSpacing: "0.1em" }}>KICKIQ</span>
          </Link>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/discover" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 10, color: text2, textDecoration: "none", border: `1px solid ${border}` }}>Discover</Link>
            <Link href="/analyze" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, borderRadius: 10, color: "white", textDecoration: "none", background: "linear-gradient(135deg,#059669,#0D9488)", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }}>+ Add Video</Link>
            <button onClick={toggleTheme} style={{ padding: "7px 13px", borderRadius: 20, cursor: "pointer", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.08)", border: `1px solid ${border}`, color: text2, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {isDark
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>Light</>
                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>Dark</>}
            </button>

            {/* Me dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMeOpen(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px 6px 8px", borderRadius: 20, cursor: "pointer", background: meOpen ? (isDark ? "rgba(5,150,105,0.15)" : "#E6F9F2") : (isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.08)"), border: `1px solid ${meOpen ? "rgba(5,150,105,0.4)" : border}`, color: text1, fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}
              >
                {/* Avatar */}
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {profile.photoUrl
                    ? <img src={profile.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ color: "white", fontWeight: 800, fontSize: 11, fontFamily: "var(--font-display)" }}>{(profile.name || "M")[0].toUpperCase()}</span>
                  }
                </div>
                Me
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "transform 0.15s", transform: meOpen ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              {/* Dropdown panel */}
              {meOpen && (
                <div
                  style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 190, background: isDark ? "#1A2420" : "white", border: `1px solid ${border}`, borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", overflow: "hidden", zIndex: 100 }}
                  onMouseLeave={() => setMeOpen(false)}
                >
                  {(isRecruiter ? [
                    { id: "scout-board",  label: "Scout Board",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
                    { id: "watchlist",    label: "Watchlist",    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
                    { id: "messages-rec", label: "Messages",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                    { id: "settings-rec", label: "Settings",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                  ] : [
                    { id: "performance", label: "Performance", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
                    { id: "progress",    label: "Progress",    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                    { id: "explore",     label: "Explore",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
                    { id: "settings",    label: "Profile",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                  ]).map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => { setActiveTab(t.id); setMeOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px", background: activeTab === t.id ? (isDark ? "rgba(5,150,105,0.12)" : "#F0FDF9") : "none", border: "none", borderTop: i > 0 ? `1px solid ${border}` : "none", cursor: "pointer", color: activeTab === t.id ? "#10B981" : text1, fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, textAlign: "left", transition: "background 0.12s" }}
                    >
                      <span style={{ opacity: activeTab === t.id ? 1 : 0.45, color: activeTab === t.id ? "#10B981" : "currentColor" }}>{t.icon}</span>
                      {t.label}
                      {activeTab === t.id && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── EMPTY STATE ── */}
      {!profileComplete && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "100px 24px", textAlign: "center" }}>
          <div style={{ width: 100, height: 100, borderRadius: 28, background: isDark ? "rgba(5,150,105,0.1)" : "#F0FDF9", border: `2px dashed ${isDark ? "rgba(5,150,105,0.3)" : "#A7F3D0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.4" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, color: text1, lineHeight: 1.1, marginBottom: 14 }}>Build Your Profile</p>
          <p style={{ color: text2, fontSize: 16, lineHeight: 1.6, marginBottom: 36 }}>Add your info to track performance and get discovered by coaches.</p>
          <button onClick={() => setEditOpen(true)} style={{ padding: "16px 40px", fontSize: 18, fontFamily: "var(--font-display)", fontWeight: 800, borderRadius: 16, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", border: "none", cursor: "pointer", width: "100%", boxShadow: "0 8px 24px rgba(5,150,105,0.35)" }}>
            Get Started →
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {profileComplete && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 80px" }}>

          {/* ── PERFORMANCE TAB ── */}
          {activeTab === "performance" && (
            <>
              {/* Slim identity strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, padding: "12px 18px", background: card, border: `1px solid ${border}`, borderRadius: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", flexShrink: 0, border: `2px solid ${border}` }}>
                  {profile.photoUrl
                    ? <img src={profile.photoUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 19, color: "white" }}>{profile.name.charAt(0).toUpperCase()}</span>
                      </div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: text1 }}>{profile.name}</p>
                    {profile.primaryPosition && <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(5,150,105,0.12)", color: "#10B981", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 100, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{profile.primaryPosition}</span>}
                    {profile.openToRecruitment && <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 100, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Open to Recruit</span>}
                  </div>
                  <p style={{ fontSize: 11, color: text2, marginTop: 2 }}>{[profile.currentClub, profile.location, profile.age ? `Age ${profile.age}` : ""].filter(Boolean).join(" · ")}</p>
                </div>
                <div style={{ display: "flex", gap: 18, flexShrink: 0, borderLeft: `1px solid ${border}`, paddingLeft: 18 }}>
                  {bestSpeed && <div style={{ textAlign: "center" }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#10B981", lineHeight: 1 }}>{bestSpeed.toFixed(1)}</p><p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>m/s best</p></div>}
                  <div style={{ textAlign: "center" }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: text1, lineHeight: 1 }}>{sessions.length}</p><p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Sessions</p></div>
                  {avgSymmetry && <div style={{ textAlign: "center" }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: text1, lineHeight: 1 }}>{avgSymmetry.toFixed(0)}%</p><p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Symmetry</p></div>}
                </div>
              </div>

              {sessions.length === 0 ? (
                <div style={{ padding: "60px 24px", textAlign: "center", background: card, border: `1px solid ${border}`, borderRadius: 18 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" style={{ margin: "0 auto 20px", display: "block" }}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: text1, marginBottom: 10 }}>No sessions yet</p>
                  <p style={{ color: text2, fontSize: 15, marginBottom: 28 }}>Upload your first training video to get AI-powered insights.</p>
                  <Link href="/analyze" style={{ padding: "14px 32px", borderRadius: 14, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-block" }}>Analyze First Video →</Link>
                </div>
              ) : (
                <>
                  {/* ── HERO VIDEO ── */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1, marginBottom: 12 }}>Hero Videos</p>
                    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", height: 360, background: "#071A10", cursor: "pointer" }}>
                      <img src={sessions[0].thumbnail || SESSION_THUMBS[0]} alt="" crossOrigin={sessions[0].thumbnail ? undefined : "anonymous"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(3,12,7,0.7) 0%, rgba(3,12,7,0.25) 50%, rgba(3,12,7,0.88) 100%)" }} />
                      {/* Session label — top left */}
                      <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", borderRadius: 10, padding: "7px 13px", border: "1px solid rgba(255,255,255,0.09)" }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Session {new Date(sessions[0].date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "white", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessions[0].videoName}</p>
                      </div>
                      {/* HUD chips — top right */}
                      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        {sessions[0].peakSpeedMs && (
                          <div style={{ background: "rgba(5,150,105,0.88)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "6px 11px", display: "flex", alignItems: "center", gap: 5 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "white", fontFamily: "var(--font-display)" }}>{sessions[0].peakSpeedMs.toFixed(2)} m/s</span>
                          </div>
                        )}
                        {sessions[0].symmetryScore && (
                          <div style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "6px 11px", border: "1px solid rgba(6,182,212,0.4)", display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 11 }}>⚖️</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#06B6D4" }}>{sessions[0].symmetryScore.toFixed(0)}% sym</span>
                          </div>
                        )}
                      </div>
                      {/* Play button */}
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(5,150,105,0.88)", border: "3px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(5,150,105,0.5), 0 0 80px rgba(5,150,105,0.2)" }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                      </div>
                      {/* Bottom HUD bar */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)", padding: "50px 20px 18px" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", gap: 24 }}>
                            {sessions[0].highlights?.slice(0, 2).map((h, i) => (
                              <div key={i}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{h.label}</p>
                                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "white", lineHeight: 1 }}>{h.value}</p>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {sessions[0].overallRisk && <span style={{ fontSize: 11, fontWeight: 800, color: riskColor(sessions[0].overallRisk), background: `${riskColor(sessions[0].overallRisk)}22`, border: `1px solid ${riskColor(sessions[0].overallRisk)}44`, borderRadius: 100, padding: "3px 10px" }}>{riskLabel(sessions[0].overallRisk)} Risk</span>}
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{sessions[0].videoDuration.toFixed(0)}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Below-hero metric strip */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      {[
                        { icon: "sprint", label: "Max Sprint Speed", value: sessions[0].peakSpeedMs ? `${sessions[0].peakSpeedMs.toFixed(2)} m/s` : "—" },
                        (() => {
                          const turnHighlight = sessions[0].highlights?.find(h => h.label.toLowerCase().includes("turn"));
                          const rawVal = turnHighlight?.value ?? null;
                          const numVal = rawVal ? parseFloat(rawVal) : null;
                          const isHighOutlier = numVal !== null && numVal > 12;
                          return { icon: "agility", label: "Quickest Turn", value: rawVal ?? "—", subLabel: "lat. acceleration", outlier: isHighOutlier };
                        })(),
                      ].map(m => (
                        <div key={m.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(5,150,105,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {m.icon === "sprint" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-8 3 3 2-5"/><path d="M6 20h4"/><path d="M15 20h3"/></svg>}
                            {m.icon === "agility" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="m15 8 4 4-4 4"/></svg>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{m.label}:</p>
                            <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: text1, whiteSpace: "nowrap" }}>{m.value}{(m as any).outlier && <span style={{ fontSize: 9, fontWeight: 600, color: "#F59E0B", marginLeft: 4 }}>est.</span>}</p>
                            {(m as any).subLabel && <p style={{ fontSize: 9, color: text2, marginTop: 1 }}>{(m as any).subLabel}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── TOP MOMENTS ── */}
                  {topMoments.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1, marginBottom: 12 }}>Top Moments</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {topMoments.slice(0, 3).map((h, i) => {
                          const meta = [{ icon: "bolt", color: "#10B981" }, { icon: "sprint", color: "#A78BFA" }, { icon: "agility", color: "#06B6D4" }][i] ?? { icon: "bolt", color: "#10B981" };
                          return (
                            <div key={i} style={{ background: isDark ? "#141A17" : "white", border: `1px solid ${border}`, borderRadius: 16, padding: "20px 18px", position: "relative", overflow: "hidden" }}>
                              {/* glow behind */}
                              <div style={{ position: "absolute", top: -28, right: -28, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${meta.color}18 0%, transparent 70%)`, pointerEvents: "none" }} />
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}18`, border: `1px solid ${meta.color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {meta.icon === "bolt" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
                                  {meta.icon === "sprint" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round"><path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="m7.5 14 2.5-6 3 3 2-3.5"/><path d="M5 20h14"/></svg>}
                                  {meta.icon === "agility" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>}
                                </div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h.label}</p>
                              </div>
                              {h.value && <p style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 32, color: text1, lineHeight: 1, marginBottom: 6 }}>{h.value}</p>}
                              {h.label === "Peak Stride Power" && (() => {
                                const nm = parseFloat(h.value) || 0;
                                const age = parseInt(profile.age || "20");
                                const ht  = parseFloat((profile as any).heightCm || "170");
                                const wt  = parseFloat((profile as any).weightKg || "70");
                                const ageFactor = age < 10 ? 0.50 : age < 14 ? 0.65 : age < 18 ? 0.80 : age < 35 ? 1.0 : 0.90;
                                const refMax = 130 * ageFactor * (ht / 170) * (wt / 70);
                                const ratio  = Math.min(1, Math.max(0, nm / refMax));
                                const bandLabel = ratio < 0.3 ? "Light" : ratio < 0.55 ? "Moderate" : ratio < 0.8 ? "Strong" : "Max Power";
                                const bandColor = ratio < 0.3 ? "#10B981" : ratio < 0.55 ? "#F59E0B" : ratio < 0.8 ? "#F97316" : "#EF4444";
                                return (
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Light</span>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: bandColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{bandLabel}</span>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max</span>
                                    </div>
                                    <div style={{ height: 7, borderRadius: 4, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", overflow: "hidden", position: "relative" }}>
                                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #10B981 0%, #F59E0B 45%, #F97316 70%, #EF4444 100%)", opacity: 0.2, borderRadius: 4 }} />
                                      <div style={{ height: "100%", width: `${ratio * 100}%`, borderRadius: 4, background: "linear-gradient(90deg, #10B981 0%, #F59E0B 45%, #F97316 70%, #EF4444 100%)", backgroundSize: `${(1 / Math.max(ratio, 0.01)) * 100}% 100%`, transition: "width 0.5s ease" }} />
                                    </div>
                                    <p style={{ fontSize: 9, color: text2, marginTop: 4 }}>vs. your age & size profile</p>
                                  </div>
                                );
                              })()}
                              <p style={{ fontSize: 11, color: text2 }}>at {h.timestamp_s.toFixed(1)}s · {h.sessionName}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── AI INSIGHTS (top 3 + "View full breakdown" toggle) ── */}
                  {(() => {
                    const allInsights: string[] = Array.from(new Set(sessions.flatMap(s => (s as any).trainingSuggestions as string[] || [])));
                    const top = allInsights.slice(0, 3);
                    const extra = allInsights.slice(3);
                    if (!top.length) return null;
                    return (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1 }}>AI Insights</p>
                          {extra.length > 0 && (
                            <button onClick={() => setShowAllInsights(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#10B981", padding: 0 }}>
                              {showAllInsights ? "Show less ▲" : `View full breakdown (${extra.length} more) ▼`}
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {(showAllInsights ? allInsights : top).map((insight, i) => (
                            <div key={i} style={{ display: "flex", gap: 12, background: isDark ? "rgba(5,150,105,0.06)" : "#F0FDF9", border: `1px solid ${isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.18)"}`, borderRadius: 12, padding: "12px 14px" }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981" }}>{i + 1}</span>
                              </div>
                              <p style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.65)" : "#374151", lineHeight: 1.55 }}>{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── MOVEMENT SIGNATURES ── */}
                  {allMoves.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1, marginBottom: 10 }}>Movement Signatures</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {allMoves.map(m => (
                          <span key={m} style={{ fontSize: 12, fontWeight: 700, background: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "6px 14px", display: "flex", alignItems: "center", gap: 5 }}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="#10B981"><path d="M2 6l3 3 5-5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── ALL SESSIONS — YouTube-style thumbnail grid ── */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1 }}>All Sessions <span style={{ fontSize: 13, color: text2, fontWeight: 600 }}>({sessions.length})</span></p>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {compareIds.length === 0 && sessions.length >= 2 && (
                          <span style={{ fontSize: 11, color: text2, fontWeight: 600 }}>Select 2 to compare</span>
                        )}
                        <Link href="/analyze" style={{ fontSize: 13, fontWeight: 700, color: "#10B981", textDecoration: "none" }}>+ Add Video →</Link>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
                      {sessions.map((s, idx) => {
                        const thumb = s.thumbnail || SESSION_THUMBS[idx % SESSION_THUMBS.length];
                        const rc = { color: riskColor(s.overallRisk), label: riskLabel(s.overallRisk) };
                        const isSelected = compareIds.includes(s.id);
                        return (
                          <div key={s.id} style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${isSelected ? "rgba(5,150,105,0.5)" : border}`, background: isDark ? "#141A17" : "white", boxShadow: isSelected ? "0 0 0 2px rgba(5,150,105,0.25)" : "none", transition: "box-shadow 0.15s" }}>
                            {/* Thumbnail */}
                            <div style={{ position: "relative", height: 148, cursor: "pointer" }} onClick={() => toggleCompare(s.id)}>
                              <img src={thumb} alt="" crossOrigin={s.thumbnail ? undefined : "anonymous"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.62) 100%)" }} />
                              {/* Compare checkbox */}
                              <div style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? "#059669" : "rgba(255,255,255,0.4)"}`, background: isSelected ? "#059669" : "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              {/* Play button */}
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(0,0,0,0.48)", border: "2px solid rgba(255,255,255,0.38)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                </div>
                              </div>
                              {/* Speed badge */}
                              {s.peakSpeedMs && <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(5,150,105,0.9)", borderRadius: 6, padding: "3px 8px" }}><span style={{ fontSize: 11, fontWeight: 800, color: "white" }}>{s.peakSpeedMs.toFixed(1)} m/s</span></div>}
                              {/* Risk badge */}
                              {s.overallRisk && <div style={{ position: "absolute", bottom: 8, left: 8, background: `${rc.color}28`, border: `1px solid ${rc.color}55`, borderRadius: 6, padding: "2px 7px", backdropFilter: "blur(4px)" }}><span style={{ fontSize: 9, fontWeight: 800, color: rc.color }}>{rc.label}</span></div>}
                              {/* Duration */}
                              <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", background: "rgba(0,0,0,0.45)", borderRadius: 4, padding: "2px 6px" }}>{s.videoDuration.toFixed(0)}s</span>
                            </div>
                            {/* Info row */}
                            <div style={{ padding: "10px 12px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{s.videoName}</p>
                                <p style={{ fontSize: 10, color: text2 }}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}{s.peakTorqueNm ? ` · ${s.peakTorqueNm.toFixed(0)} Nm` : ""}</p>
                              </div>
                              <div style={{ display: "flex", gap: 4, marginLeft: 8, flexShrink: 0 }}>
                                <button onClick={() => togglePin(s.id)} style={{ width: 26, height: 26, borderRadius: "50%", background: pinnedIds.includes(s.id) ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${pinnedIds.includes(s.id) ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", color: pinnedIds.includes(s.id) ? "#FBBF24" : "rgba(255,255,255,0.25)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
                                <button onClick={() => removeSession(s.id)} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.2)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── PROGRESS TAB ── */}
          {activeTab === "progress" && (
            <ProgressTab sessions={sessions} isDark={isDark} />
          )}

          {/* ── EXPLORE TAB ── */}
          {activeTab === "explore" && (
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: text1, marginBottom: 6 }}>Explore</p>
              <p style={{ color: text2, fontSize: 14, marginBottom: 28 }}>Resources, training content, and recruiting guides for soccer players.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {EXPLORE.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, overflow: "hidden", transition: "all 0.15s", cursor: "pointer" }}>
                      <div style={{ height: 160, overflow: "hidden" }}>
                        <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.cat}</span>
                        <p style={{ fontWeight: 700, fontSize: 15, color: text1, marginTop: 4, marginBottom: 4, lineHeight: 1.3 }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: text2 }}>{item.source}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── PROFILE / SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: text1, marginBottom: 24 }}>Profile Settings</p>

              {/* Profile card */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", border: `2px solid ${border}`, flexShrink: 0 }}>
                    {profile.photoUrl ? <img src={profile.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color: "white" }}>{profile.name.charAt(0).toUpperCase()}</span></div>}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 17, color: text1 }}>{profile.name}</p>
                    <p style={{ fontSize: 13, color: text2 }}>{profile.email || "No email set"}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => setEditOpen(true)} style={{ width: "100%", padding: "12px", borderRadius: 12, background: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5", border: "1px solid rgba(5,150,105,0.2)", color: "#10B981", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    Edit Profile Info →
                  </button>
                  <Link href="/athlete" style={{ display: "block", width: "100%", padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${border}`, color: text2, fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
                    Preview Public Profile →
                  </Link>
                </div>
              </div>

              {/* Account type */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 24px", marginBottom: 14 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: text1, marginBottom: 4 }}>Account Type</p>
                <p style={{ fontSize: 12, color: text2, marginBottom: 14 }}>Switch to Recruiter to view and connect with athletes.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(["athlete","recruiter"] as const).map(t => (
                    <button key={t} onClick={() => setProfile({ accountType: t } as any)} style={{ padding: "12px", borderRadius: 12, border: `1px solid ${(profile as any).accountType === t || (!( profile as any).accountType && t === "athlete") ? "rgba(5,150,105,0.4)" : border}`, background: (profile as any).accountType === t || (!(profile as any).accountType && t === "athlete") ? "rgba(5,150,105,0.1)" : "transparent", color: (profile as any).accountType === t || (!(profile as any).accountType && t === "athlete") ? "#10B981" : text2, fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
                      {t === "athlete" ? "Athlete" : "Recruiter / Coach"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Open to recruitment */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 24px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: text1 }}>Open to Recruitment</p>
                  <p style={{ fontSize: 12, color: text2, marginTop: 2 }}>Let coaches and recruiters discover your profile</p>
                </div>
                <button type="button" onClick={() => setProfile({ openToRecruitment: !profile.openToRecruitment })}
                  style={{ position: "relative", width: 52, height: 30, borderRadius: 15, border: "none", cursor: "pointer", background: profile.openToRecruitment ? "#059669" : isDark ? "rgba(255,255,255,0.1)" : "#D1D5DB", transition: "background 0.2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: profile.openToRecruitment ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "white", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                </button>
              </div>

              {/* Danger zone */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 24px" }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Account</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => { sessionStorage.removeItem(AUTHED_KEY); window.location.href = "/login"; }}
                    style={{ width: "100%", padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${border}`, color: text2, fontWeight: 600, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                    Log out
                  </button>
                  <button onClick={() => { if (confirm("Delete your profile and all sessions? This cannot be undone.")) { localStorage.removeItem("kaori_profile"); localStorage.removeItem("kaori_sessions"); window.location.href = "/"; } }}
                    style={{ width: "100%", padding: "12px", borderRadius: 12, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", fontWeight: 600, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── RECRUITER: SCOUT BOARD TAB ── */}
          {activeTab === "scout-board" && isRecruiter && (
            <div>
              {/* Recruiter header strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px 20px", background: card, border: `1px solid ${border}`, borderRadius: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color: "white" }}>{(profile.name || "R")[0].toUpperCase()}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: text1 }}>{profile.name || "Recruiter"}</p>
                    <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.12)", color: "#0D9488", border: "1px solid rgba(13,148,136,0.25)", borderRadius: 100, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {(profile as any).recruiterRole || "Scout"}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: text2, marginTop: 2 }}>{(profile as any).organization || profile.currentClub || "Independent Scout"}</p>
                </div>
                <div style={{ display: "flex", gap: 20, flexShrink: 0, borderLeft: `1px solid ${border}`, paddingLeft: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#10B981", lineHeight: 1 }}>{watchlist.length}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Watching</p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: text1, lineHeight: 1 }}>{MOCK_ATHLETES.length}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Athletes</p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: text1, lineHeight: 1 }}>{sessions.length}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>Reviewed</p>
                  </div>
                </div>
              </div>

              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1, marginBottom: 6 }}>Scout Board</p>
              <p style={{ color: text2, fontSize: 13, marginBottom: 20 }}>Browse athlete profiles. Watch or message any prospect.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {MOCK_ATHLETES.map(athlete => {
                  const inWatch = watchlist.includes(athlete.id);
                  return (
                    <div key={athlete.id} style={{ background: card, border: `1px solid ${inWatch ? "rgba(5,150,105,0.4)" : border}`, borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12, boxShadow: inWatch ? "0 0 0 2px rgba(5,150,105,0.15)" : "none", transition: "all 0.15s" }}>
                      {/* Avatar + position badge */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "white", fontWeight: 900, fontSize: 20, fontFamily: "var(--font-display)" }}>{athlete.photoInitial}</span>
                          </div>
                          {inWatch && <div style={{ position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#059669", border: "2px solid " + bg, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 800, fontSize: 15, color: text1, marginBottom: 2 }}>{athlete.name}</p>
                          <p style={{ fontSize: 11, color: text2 }}>{athlete.age} · {athlete.club}</p>
                          <p style={{ fontSize: 11, color: text2 }}>{athlete.location}</p>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(5,150,105,0.1)", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>{athlete.position}</span>
                      </div>
                      {/* Stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(5,150,105,0.04)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Speed</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: "#10B981" }}>{athlete.peakSpeedMs}</p>
                          <p style={{ fontSize: 8, color: text2 }}>m/s</p>
                        </div>
                        <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(5,150,105,0.04)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Symmetry</p>
                          <p style={{ fontSize: 14, fontWeight: 800, color: "#06B6D4" }}>{athlete.symmetryScore}%</p>
                          <p style={{ fontSize: 8, color: text2 }}>balance</p>
                        </div>
                        <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(5,150,105,0.04)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: text2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Risk</p>
                          <span style={{ fontSize: 10, fontWeight: 800, color: riskColor(athlete.overallRisk) }}>{athlete.overallRisk === "low" ? "Low" : athlete.overallRisk === "moderate" ? "Mod" : "High"}</span>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button
                          onClick={() => toggleWatchlist(athlete.id)}
                          style={{ padding: "9px 0", borderRadius: 10, border: `1px solid ${inWatch ? "rgba(5,150,105,0.4)" : border}`, background: inWatch ? "rgba(5,150,105,0.12)" : "transparent", color: inWatch ? "#10B981" : text2, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill={inWatch ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {inWatch ? "Watching" : "Watch"}
                        </button>
                        <button
                          onClick={() => openMessageWith(athlete.id)}
                          style={{ padding: "9px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RECRUITER: WATCHLIST TAB ── */}
          {activeTab === "watchlist" && isRecruiter && (
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1, marginBottom: 6 }}>Watchlist</p>
              <p style={{ color: text2, fontSize: 13, marginBottom: 20 }}>Athletes you are actively monitoring.</p>
              {watchlist.length === 0 ? (
                <div style={{ padding: "80px 24px", textAlign: "center", background: card, border: `1px solid ${border}`, borderRadius: 18 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5", border: `2px dashed ${isDark ? "rgba(5,150,105,0.3)" : "#A7F3D0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1, marginBottom: 8 }}>Your watchlist is empty</p>
                  <p style={{ color: text2, fontSize: 14, marginBottom: 20 }}>Go to Scout Board and hit "Watch" on promising athletes.</p>
                  <button onClick={() => setActiveTab("scout-board")} style={{ padding: "12px 28px", borderRadius: 12, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>Open Scout Board →</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                  {MOCK_ATHLETES.filter(a => watchlist.includes(a.id)).map(athlete => (
                    <div key={athlete.id} style={{ background: card, border: `1px solid rgba(5,150,105,0.3)`, borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ color: "white", fontWeight: 900, fontSize: 18, fontFamily: "var(--font-display)" }}>{athlete.photoInitial}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 800, fontSize: 14, color: text1 }}>{athlete.name}</p>
                          <p style={{ fontSize: 11, color: text2 }}>{athlete.position} · {athlete.club}</p>
                        </div>
                        <button onClick={() => toggleWatchlist(athlete.id)} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(5,150,105,0.12)", border: "1px solid rgba(5,150,105,0.3)", cursor: "pointer", color: "#10B981", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>{athlete.peakSpeedMs} m/s</span>
                        <span style={{ fontSize: 11, color: text2 }}>·</span>
                        <span style={{ fontSize: 11, color: text2 }}>{athlete.symmetryScore}% sym</span>
                        <span style={{ fontSize: 11, color: text2 }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: riskColor(athlete.overallRisk) }}>{athlete.overallRisk} risk</span>
                      </div>
                      <button onClick={() => openMessageWith(athlete.id)} style={{ padding: "8px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Message →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RECRUITER: MESSAGES TAB ── */}
          {activeTab === "messages-rec" && isRecruiter && (
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1, marginBottom: 20 }}>Messages</p>
              <MessagingPanel
                isDark={isDark} bg={bg} card={card} border={border} text1={text1} text2={text2}
                activeMsgConvId={activeMsgConvId}
                setActiveMsgConvId={setActiveMsgConvId}
                openWithAthleteId={msgOpenWithAthlete}
                isRecruiter={true}
              />
            </div>
          )}

          {/* ── RECRUITER: SETTINGS TAB ── */}
          {activeTab === "settings-rec" && isRecruiter && (
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: text1, marginBottom: 24 }}>Recruiter Settings</p>

              {/* Identity */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 14 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: text1, marginBottom: 16 }}>Identity</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Full Name", key: "name", placeholder: "Your name" },
                    { label: "Email", key: "email", placeholder: "your@email.com" },
                    { label: "Organization / Club", key: "organization", placeholder: "FC United Scouting" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: text2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</label>
                      <input
                        value={f.key === "name" || f.key === "email" ? (profile[f.key as keyof typeof profile] as string) || "" : (profile as any)[f.key] || ""}
                        onChange={e => setProfile({ [f.key]: e.target.value } as any)}
                        placeholder={f.placeholder}
                        style={{ width: "100%", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.04)", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, color: text1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: text2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Role</label>
                    <select
                      value={(profile as any).recruiterRole || "Scout"}
                      onChange={e => setProfile({ recruiterRole: e.target.value } as any)}
                      style={{ width: "100%", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.04)", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, color: text1, outline: "none", fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box" }}
                    >
                      {["Scout","Head Coach","Analyst","Director of Recruitment"].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: text2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bio / Scouting Focus</label>
                    <textarea
                      value={profile.bio || ""}
                      onChange={e => setProfile({ bio: e.target.value })}
                      rows={3}
                      placeholder="Describe your scouting focus and methodology..."
                      style={{ width: "100%", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.04)", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, color: text1, outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>

              {/* Account type switcher */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 24px", marginBottom: 14 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: text1, marginBottom: 4 }}>Account Type</p>
                <p style={{ fontSize: 12, color: text2, marginBottom: 14 }}>Switch back to Athlete mode to upload and track sessions.</p>
                <button onClick={() => setProfile({ accountType: "athlete" } as any)} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${border}`, color: text2, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Switch to Athlete Mode
                </button>
              </div>

              {/* Danger zone */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: "18px 24px" }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: text2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Account</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => { sessionStorage.removeItem(AUTHED_KEY); window.location.href = "/login"; }} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${border}`, color: text2, fontWeight: 600, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                    Log out
                  </button>
                  <button onClick={() => { if (confirm("Delete your account? This cannot be undone.")) { localStorage.removeItem("kaori_profile"); localStorage.removeItem("kaori_sessions"); window.location.href = "/"; } }} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", fontWeight: 600, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── ATHLETE: MESSAGES TAB (for athlete accounts) ── */}
          {activeTab === "messages" && !isRecruiter && (
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1, marginBottom: 20 }}>Messages</p>
              <MessagingPanel
                isDark={isDark} bg={bg} card={card} border={border} text1={text1} text2={text2}
                activeMsgConvId={activeMsgConvId}
                setActiveMsgConvId={setActiveMsgConvId}
                openWithAthleteId={null}
                isRecruiter={false}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
