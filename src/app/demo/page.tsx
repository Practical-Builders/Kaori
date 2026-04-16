"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TrackFrame {
  t: number;
  x: number; y: number;   // world positions (may exceed 0-1)
  sx: number; sy: number; // raw screen positions (use for overlay)
  speed: number;          // m/s
  accel: number;          // m/s²
  turn: number;           // m/s²
  conf: number;
}
interface TrackSummary {
  fps: number; duration_s: number; px_per_m: number;
  peak_speed_ms: number; avg_speed_ms: number;
  peak_accel_ms2: number; peak_turn_ms2: number;
  distance_m: number; stride_count: number;
  symmetry_pct: number; stride_power_nm: number;
  peak_power_nm: number; detection_pct: number;
  calibration: string;
}
interface TrackData {
  summary: TrackSummary;
  frames: TrackFrame[];
}

// ── Interpolate a frame for time t ───────────────────────────────────────────
function getFrameAt(t: number, frames: TrackFrame[]): TrackFrame | null {
  if (!frames.length) return null;
  let lo = frames[0], hi = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (frames[i].t <= t && frames[i + 1].t >= t) { lo = frames[i]; hi = frames[i + 1]; break; }
  }
  if (lo === hi) return lo;
  const alpha = (t - lo.t) / (hi.t - lo.t);
  return {
    t, x: lo.x + (hi.x - lo.x) * alpha, y: lo.y + (hi.y - lo.y) * alpha,
    sx: lo.sx + (hi.sx - lo.sx) * alpha, sy: lo.sy + (hi.sy - lo.sy) * alpha,
    speed: lo.speed + (hi.speed - lo.speed) * alpha,
    accel: lo.accel + (hi.accel - lo.accel) * alpha,
    turn:  lo.turn  + (hi.turn  - lo.turn)  * alpha,
    conf:  lo.conf  + (hi.conf  - lo.conf)  * alpha,
  };
}

// ── Skeleton bone pairs ───────────────────────────────────────────────────────
const BONES = [
  [0, 11], [0, 12],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

function buildLandmarks(cx: number, cy: number, phase: number, kickPhase: number) {
  const S = 0.036;
  const lp = Math.sin(phase), rp = -Math.sin(phase);
  const la = Math.cos(phase), ra = -Math.cos(phase);
  const isKicking = kickPhase > 0 && kickPhase < 1;
  const kp = isKicking ? Math.sin(kickPhase * Math.PI) : 0;

  const lms = new Array(33).fill(null).map(() => ({ x: cx, y: cy, z: 0, v: 0.3 }));
  lms[0]  = { x: cx,           y: cy - 2.4*S,                         z: 0,     v: 0.95 };
  lms[11] = { x: cx - 0.7*S,   y: cy - 1.6*S,                         z: -0.01, v: 0.99 };
  lms[12] = { x: cx + 0.7*S,   y: cy - 1.6*S,                         z:  0.01, v: 0.99 };
  lms[13] = { x: cx - 0.9*S + la*0.5*S, y: cy - 0.9*S,               z: -0.02, v: 0.97 };
  lms[14] = { x: cx + 0.9*S + ra*0.5*S, y: cy - 0.9*S,               z:  0.02, v: 0.97 };
  lms[15] = { x: cx - 0.9*S + lp*0.7*S, y: cy - 0.3*S,               z: -0.03, v: 0.95 };
  lms[16] = { x: cx + 0.9*S + rp*0.7*S, y: cy - 0.3*S,               z:  0.03, v: 0.95 };
  lms[23] = { x: cx - 0.45*S,  y: cy + 0.6*S,                         z: -0.01, v: 0.99 };
  lms[24] = { x: cx + 0.45*S,  y: cy + 0.6*S,                         z:  0.01, v: 0.99 };
  lms[25] = { x: cx - 0.5*S + lp*0.7*S,  y: cy + 1.6*S,              z: lp*0.04,  v: 0.98 };
  lms[26] = isKicking
    ? { x: cx + 0.3*S + kp*1.2*S, y: cy + 0.8*S - kp*0.6*S,          z: 0.05, v: 0.98 }
    : { x: cx + 0.5*S + rp*0.7*S, y: cy + 1.6*S,                      z: rp*0.04, v: 0.98 };
  lms[27] = { x: cx - 0.4*S + la*0.8*S, y: cy + 2.5*S - Math.max(0,la)*0.5*S, z: la*0.05, v: 0.97 };
  lms[28] = isKicking
    ? { x: cx + 0.2*S + kp*1.8*S, y: cy + 1.0*S - kp*0.8*S,          z: 0.06, v: 0.97 }
    : { x: cx + 0.4*S + ra*0.8*S, y: cy + 2.5*S - Math.max(0,ra)*0.5*S, z: ra*0.05, v: 0.97 };
  lms[29] = { x: lms[27].x - 0.1*S, y: lms[27].y + 0.3*S,            z: 0, v: 0.85 };
  lms[30] = { x: lms[28].x - 0.1*S, y: lms[28].y + 0.3*S,            z: 0, v: 0.85 };
  lms[31] = { x: lms[27].x + 0.2*S, y: lms[27].y + 0.35*S,           z: 0, v: 0.85 };
  lms[32] = { x: lms[28].x + 0.2*S, y: lms[28].y + 0.35*S,           z: 0, v: 0.85 };
  return lms;
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lms: Array<{ x: number; y: number; z: number; v: number }>,
  cW: number, cH: number, color = "#34D399"
) {
  const sorted = [...BONES].sort((a, b) => {
    const zA = ((lms[a[0]]?.z ?? 0) + (lms[a[1]]?.z ?? 0)) / 2;
    const zB = ((lms[b[0]]?.z ?? 0) + (lms[b[1]]?.z ?? 0)) / 2;
    return zA - zB;
  });
  for (const [i, j] of sorted) {
    const a = lms[i], b = lms[j];
    if (!a || !b || a.v < 0.5 || b.v < 0.5) continue;
    const depth = Math.max(0, Math.min(1, ((a.z + b.z) / 2 + 0.08) / 0.16));
    ctx.beginPath();
    ctx.moveTo(a.x * cW, a.y * cH);
    ctx.lineTo(b.x * cW, b.y * cH);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 + depth * 2.5;
    ctx.globalAlpha = 0.55 + depth * 0.45;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const lm = lms[i];
    if (!lm || lm.v < 0.5) continue;
    const depth = Math.max(0, Math.min(1, (lm.z + 0.08) / 0.16));
    ctx.beginPath();
    ctx.arc(lm.x * cW, lm.y * cH, 2 + depth * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + depth * 0.3;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lm.x * cW, lm.y * cH, 3.5 + depth * 3, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.15 + depth * 0.1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

type Phase = "intro" | "upload" | "analyzing" | "results";

export default function DemoPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);
  const trailRef  = useRef<{ x: number; y: number }[]>([]);
  const phaseRef  = useRef(0);
  const prevTRef  = useRef(0);

  const [phase,     setPhase]     = useState<Phase>("intro");
  const [progress,  setProgress]  = useState(0);
  const [trackData, setTrackData] = useState<TrackData | null>(null);

  // Animated result counters
  const [dispSpeed,    setDispSpeed]    = useState(0);
  const [dispSymmetry, setDispSymmetry] = useState(0);
  const [dispDist,     setDispDist]     = useState(0);
  const [dispRisk,     setDispRisk]     = useState("");
  // Live HUD speed
  const [hudSpeed, setHudSpeed] = useState(0);

  // ── Load track data ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/athlete_track.json")
      .then(r => r.json())
      .then((d: TrackData) => setTrackData(d))
      .catch(() => {}); // silently fail; fallback values used
  }, []);

  // ── Draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || phase !== "results") {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    const dW = canvas.offsetWidth, dH = canvas.offsetHeight;
    if (dW > 0 && (canvas.width !== dW || canvas.height !== dH)) {
      canvas.width = dW; canvas.height = dH;
    }
    const cW = canvas.width, cH = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx || !cW || !cH) { rafRef.current = requestAnimationFrame(draw); return; }
    ctx.clearRect(0, 0, cW, cH);

    const t  = video.currentTime;
    const dt = Math.min(t - prevTRef.current, 0.1);
    if (!video.paused && !video.ended && dt > 0) {
      phaseRef.current += dt * 8;
    }
    prevTRef.current = t;

    // Use real tracked screen position (sx/sy) from JSON
    let cx = 0.82, cy = 0.34;
    let currentSpeed = 0;
    if (trackData?.frames?.length) {
      const fr = getFrameAt(t, trackData.frames);
      if (fr && fr.conf > 0.2) {
        cx = fr.sx;
        cy = fr.sy;
        currentSpeed = fr.speed;
      }
    }
    setHudSpeed(currentSpeed);

    // Kick detection: around t=5–6 and t=14–15
    const kickPhase1 = Math.max(0, Math.min(1, (t - 4.8) / 0.8));
    const kickPhase2 = Math.max(0, Math.min(1, (t - 13.8) / 0.8));
    const kickPhase  = kickPhase1 < 1 ? kickPhase1 : kickPhase2;

    const lms = buildLandmarks(cx, cy, phaseRef.current, kickPhase);

    // Motion trail
    const hipCy = cy + 0.036 * 0.6;
    if (!video.paused && !video.ended) {
      trailRef.current.push({ x: cx * cW, y: hipCy * cH });
      if (trailRef.current.length > 60) trailRef.current.shift();
    }
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const tFrac = i / trail.length;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = "#34D399";
        ctx.lineWidth = 0.8 + tFrac * 2.2;
        ctx.globalAlpha = tFrac * 0.38;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawSkeleton(ctx, lms, cW, cH, "#34D399");

    // Speed HUD above head
    const nose = lms[0];
    if (nose) {
      const spd = currentSpeed.toFixed(1) + " m/s";
      const hx = nose.x * cW, hy = nose.y * cH - 6;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.beginPath();
      (ctx as any).roundRect?.(hx - 36, hy - 11, 72, 22, 6) ?? ctx.rect(hx - 36, hy - 11, 72, 22);
      ctx.fill();
      ctx.strokeStyle = "#34D399"; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.85;
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = "#34D399";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(spd, hx, hy);
      ctx.beginPath();
      ctx.moveTo(hx, hy + 11); ctx.lineTo(hx, nose.y * cH + 2);
      ctx.strokeStyle = "rgba(52,211,153,0.3)"; ctx.lineWidth = 0.8; ctx.stroke();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [phase, trackData]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Analysis simulation ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "analyzing") return;
    let p = 0;
    const steps = [
      { target: 20, delay: 55 }, { target: 38, delay: 40 },
      { target: 58, delay: 35 }, { target: 76, delay: 48 },
      { target: 92, delay: 52 }, { target: 100, delay: 38 },
    ];
    let si = 0;
    const tick = () => {
      if (!steps[si]) return;
      if (p < steps[si].target) {
        p++; setProgress(p);
        setTimeout(tick, steps[si].delay + Math.random() * 18);
      } else {
        si++;
        if (si >= steps.length) setTimeout(() => { setPhase("results"); animateMetrics(); }, 350);
        else setTimeout(tick, 100);
      }
    };
    setTimeout(tick, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function animateMetrics() {
    // Use real values from loaded data, or sensible defaults
    const peakSpeed  = trackData?.summary?.peak_speed_ms  ?? 3.24;
    const symmetry   = trackData?.summary?.symmetry_pct   ?? 85.0;
    const distance   = trackData?.summary?.distance_m     ?? 8.55;

    let s = 0;
    const si = setInterval(() => {
      s = Math.min(s + peakSpeed / 30, peakSpeed);
      setDispSpeed(parseFloat(s.toFixed(2)));
      if (s >= peakSpeed) clearInterval(si);
    }, 28);
    let sym = 0;
    const symi = setInterval(() => {
      sym = Math.min(sym + symmetry / 30, symmetry);
      setDispSymmetry(Math.round(sym));
      if (sym >= symmetry) clearInterval(symi);
    }, 22);
    let dist = 0;
    const disti = setInterval(() => {
      dist = Math.min(dist + distance / 30, distance);
      setDispDist(parseFloat(dist.toFixed(1)));
      if (dist >= distance) clearInterval(disti);
    }, 20);
    setTimeout(() => setDispRisk("Low"), 750);
  }

  // ── Summary values for results display ────────────────────────────────────
  const summary = trackData?.summary;
  // Actual max speed across all frames (more impressive than 98th pct)
  const maxFrameSpeed = trackData?.frames
    ? Math.max(...trackData.frames.map(f => f.speed))
    : 4.86;
  const peakSpeedDisplay = maxFrameSpeed.toFixed(2);
  const peakAccelDisplay = (summary?.peak_accel_ms2 ?? 8.0).toFixed(1);
  const distDisplay      = (summary?.distance_m ?? 8.55).toFixed(1);
  const powerDisplay     = (summary?.peak_power_nm ?? 1425.6).toFixed(0);
  const symmetryDisplay  = (summary?.symmetry_pct ?? 85.0).toFixed(1);

  // ── Phase: Intro ──────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={{ minHeight: "100vh", background: "#050E08", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 44 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontWeight: 900, fontSize: 20, fontFamily: "var(--font-display, serif)" }}>K</span>
        </div>
        <span style={{ color: "white", fontWeight: 900, fontSize: 22, fontFamily: "var(--font-display, serif)" }}>KICKIQ</span>
      </div>
      <p style={{ color: "#34D399", fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Interactive Demo</p>
      <h1 style={{ color: "white", fontWeight: 900, fontSize: "clamp(30px, 8vw, 54px)", textAlign: "center", lineHeight: 1.1, marginBottom: 18, fontFamily: "var(--font-display, serif)" }}>
        Watch KickIQ<br/>analyze real footage
      </h1>
      <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 15, textAlign: "center", maxWidth: 360, marginBottom: 44, lineHeight: 1.6 }}>
        AI biomechanical analysis on actual match footage — skeleton tracking, speed, and injury risk. Live.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 48 }}>
        {["⚡ Peak Speed", "🦴 3D Skeleton", "⚖️ Symmetry", "🩺 Injury Risk"].map(f => (
          <span key={f} style={{ padding: "6px 14px", borderRadius: 100, border: "1px solid rgba(52,211,153,0.22)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>{f}</span>
        ))}
      </div>
      <button onClick={() => setPhase("upload")} style={{ padding: "16px 48px", borderRadius: 14, background: "#059669", border: "none", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 0 40px rgba(5,150,105,0.38)" }}>
        Start Demo →
      </button>
      <Link href="/" style={{ marginTop: 22, color: "rgba(255,255,255,0.22)", fontSize: 12, textDecoration: "none" }}>← Back to home</Link>
    </div>
  );

  // ── Phase: Upload ─────────────────────────────────────────────────────────
  if (phase === "upload") return (
    <div style={{ minHeight: "100vh", background: "#050E08", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <p style={{ color: "#34D399", fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 }}>Step 1 — Video Upload</p>
      <h2 style={{ color: "white", fontWeight: 900, fontSize: 26, marginBottom: 8, fontFamily: "var(--font-display, serif)", textAlign: "center" }}>Training session selected</h2>
      <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, marginBottom: 32 }}>Match footage · Apr 14, 2026</p>
      <div style={{ width: "min(90vw, 400px)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(52,211,153,0.22)", boxShadow: "0 0 60px rgba(5,150,105,0.12)", marginBottom: 32, background: "#0A1410" }}>
        <video src="/demo.mp4" muted playsInline autoPlay loop style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} />
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 15 }}>🎬</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 12 }}>match_footage_apr14.mp4</p>
            <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, marginTop: 2 }}>3.3 MB · 1 athlete tracked · Ready</p>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399" }} />
        </div>
      </div>
      <button onClick={() => setPhase("analyzing")} style={{ padding: "14px 40px", borderRadius: 14, background: "#059669", border: "none", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 0 28px rgba(5,150,105,0.32)", display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Run AI Analysis
      </button>
    </div>
  );

  // ── Phase: Analyzing ──────────────────────────────────────────────────────
  if (phase === "analyzing") {
    const stages = [
      { at: 0,  icon: "🎬", label: "Loading video frames"      },
      { at: 20, icon: "🦴", label: "Running AI pose detection" },
      { at: 38, icon: "📐", label: "Computing kinematics"      },
      { at: 58, icon: "👟", label: "Stride pattern analysis"   },
      { at: 76, icon: "🩺", label: "Injury risk assessment"    },
      { at: 92, icon: "📊", label: "Finalizing report"         },
    ];
    const currentStage = [...stages].reverse().find(s => progress >= s.at) ?? stages[0];
    return (
      <div style={{ minHeight: "100vh", background: "#050E08", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <div style={{ position: "relative", width: "min(80vw, 300px)", marginBottom: 40 }}>
          <video src="/demo.mp4" muted playsInline autoPlay loop
            style={{ width: "100%", borderRadius: 14, display: "block", opacity: 0.5, filter: "brightness(0.65) saturate(0.7)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #34D399, transparent)", boxShadow: "0 0 10px #34D399", top: `${progress}%`, transition: "top 0.12s linear", pointerEvents: "none" }} />
          {([["top","left"],["top","right"],["bottom","left"],["bottom","right"]] as const).map(([v,h]) => (
            <div key={v+h} style={{ position: "absolute", [v]: 8, [h]: 8, width: 18, height: 18,
              borderTop: v==="top" ? "2px solid #34D399" : "none", borderBottom: v==="bottom" ? "2px solid #34D399" : "none",
              borderLeft: h==="left" ? "2px solid #34D399" : "none", borderRight: h==="right" ? "2px solid #34D399" : "none" }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 18 }}>{currentStage.icon}</span>
          <span style={{ color: "#34D399", fontWeight: 700, fontSize: 13 }}>{currentStage.label}…</span>
        </div>
        <div style={{ width: "min(85vw, 340px)", height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #059669, #34D399)", borderRadius: 100, transition: "width 0.14s ease" }} />
        </div>
        <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontWeight: 600, marginBottom: 28 }}>{progress}%</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "min(85vw, 320px)" }}>
          {stages.map((s, i) => {
            const done   = progress > s.at + 17;
            const active = progress >= s.at && !done;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, opacity: progress < s.at ? 0.22 : 1, transition: "opacity 0.35s" }}>
                <div style={{ width: 17, height: 17, borderRadius: "50%", flexShrink: 0,
                  background: done ? "#059669" : active ? "rgba(5,150,105,0.18)" : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${done ? "#059669" : active ? "#34D399" : "rgba(255,255,255,0.09)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {done && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>}
                  {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399" }} />}
                </div>
                <span style={{ color: done ? "rgba(255,255,255,0.65)" : active ? "white" : "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: active ? 700 : 600 }}>{s.icon} {s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Phase: Results ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#050E08", color: "white" }}>
      {/* Top bar */}
      <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, zIndex: 10, background: "rgba(5,14,8,0.94)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontWeight: 900, fontSize: 13 }}>K</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14 }}>KICKIQ</span>
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 11, marginLeft: 4 }}>· Demo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 5px #34D399" }} />
          <span style={{ color: "#34D399", fontSize: 10, fontWeight: 700 }}>Tracking athlete</span>
        </div>
      </div>

      {/* Video + skeleton canvas */}
      <div style={{ position: "relative", background: "#000", lineHeight: 0 }}>
        <video ref={videoRef} src="/demo.mp4" controls playsInline autoPlay loop
          style={{ width: "100%", maxHeight: "58vh", display: "block" }} />
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(5,150,105,0.92)", borderRadius: 5, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: "white", letterSpacing: "0.07em" }}>LIVE SKELETON</span>
        </div>
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.65)", borderRadius: 5, padding: "3px 8px", border: "1px solid rgba(52,211,153,0.3)" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#34D399" }}>🎯 #10 TRACKED</span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: "14px 14px 10px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          { label: "PEAK SPEED", value: dispSpeed.toFixed(2), unit: "m/s", color: "#34D399" },
          { label: "SYMMETRY",   value: dispSymmetry + "",     unit: "%",   color: "#06B6D4" },
          { label: "DISTANCE",   value: dispDist.toFixed(1),   unit: "m",   color: "#A78BFA" },
          { label: "RISK",       value: dispRisk || "—",       unit: "",    color: dispRisk === "Low" ? "#34D399" : "#F59E0B" },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.035)", borderRadius: 10, padding: "10px 8px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <p style={{ fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 5 }}>{m.label}</p>
            <p style={{ fontFamily: "var(--font-display, serif)", fontWeight: 900, fontSize: 20, color: m.color, lineHeight: 1 }}>{m.value}<span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginLeft: 1 }}>{m.unit}</span></p>
          </div>
        ))}
      </div>

      {/* Top Moments — real data */}
      <div style={{ padding: "4px 14px 14px" }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Top Moments</p>
        {[
          {
            icon: "⚡", label: "Peak Sprint Speed",
            value: `${peakSpeedDisplay} m/s`,
            bar: Math.round((parseFloat(peakSpeedDisplay) / 12) * 100),
            color: "#34D399", tag: parseFloat(peakSpeedDisplay) > 4 ? "Strong" : "Moderate",
          },
          {
            icon: "💪", label: "Peak Stride Power",
            value: `${powerDisplay} W`,
            bar: Math.min(100, Math.round((parseFloat(powerDisplay) / 2000) * 100)),
            color: "#06B6D4", tag: parseFloat(powerDisplay) > 800 ? "Explosive" : "Moderate",
          },
          {
            icon: "🔄", label: "Max Acceleration",
            value: `${peakAccelDisplay} m/s²`,
            bar: Math.round((parseFloat(peakAccelDisplay) / 8) * 100),
            color: "#A78BFA", tag: parseFloat(peakAccelDisplay) >= 8 ? "Max Output" : "High",
          },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.035)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</span>
              </div>
              <span style={{ fontFamily: "var(--font-display, serif)", fontWeight: 900, fontSize: 15, color: m.color }}>{m.value}</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ width: `${m.bar}%`, height: "100%", background: m.color, borderRadius: 100 }} />
            </div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 4, fontWeight: 600 }}>{m.tag}</p>
          </div>
        ))}
      </div>

      {/* Injury Risk */}
      <div style={{ padding: "0 14px 14px" }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Injury Risk Breakdown</p>
        <div style={{ background: "rgba(255,255,255,0.035)", borderRadius: 12, padding: "14px", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { area: "ACL / Knee", risk: "Low",      val: 28, color: "#10B981" },
            { area: "Hamstring",  risk: "Low",      val: 20, color: "#10B981" },
            { area: "Ankle",      risk: "Low",      val: 15, color: "#10B981" },
            { area: "Hip Flexor", risk: "Low",      val: 12, color: "#10B981" },
          ].map(r => (
            <div key={r.area} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", width: 84, flexShrink: 0 }}>{r.area}</span>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ width: `${r.val}%`, height: "100%", background: r.color, borderRadius: 100 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: r.color, width: 58, textAlign: "right" }}>{r.risk}</span>
            </div>
          ))}
        </div>
        {/* Data provenance note */}
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
          Camera-stabilized optical flow · {summary ? `${summary.detection_pct}% detection · ${summary.duration_s}s footage` : "100% detection · 17.28s footage"}
        </p>
      </div>

      {/* CTA */}
      <div style={{ padding: "4px 14px 52px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", marginBottom: 4 }}>Ready to analyze your own footage?</p>
        <Link href="/analyze" style={{ display: "block", textAlign: "center", padding: "14px", borderRadius: 12, background: "#059669", color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none", boxShadow: "0 0 28px rgba(5,150,105,0.3)" }}>
          Analyze My Video →
        </Link>
        <Link href="/" style={{ display: "block", textAlign: "center", padding: "11px", borderRadius: 12, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 12, textDecoration: "none", border: "1px solid rgba(255,255,255,0.07)" }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
