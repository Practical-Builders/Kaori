"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { useProfile, AnalysisSession } from "@/contexts/ProfileContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type Status = "idle" | "uploading" | "analyzing_ai" | "success" | "error";

async function runGeminiAnalysis(kinematics: any, injuryRisk: any, highlights: any, profile: any, previousSession: AnalysisSession | null) {
  const clipDurationS = kinematics?.timestamp_ms?.slice(-1)[0] / 1000 ?? 0;
  const frameCount = kinematics?.timestamp_ms?.length ?? 0;
  const isShortClip = clipDurationS < 10;

  const prompt = `Athlete profile: ${profile.name || "Unknown"} | Position: ${profile.primaryPosition || "Not specified"} | Age: ${profile.age || "?"} | Height: ${profile.heightCm || "?"}cm | Weight: ${profile.weightKg || "?"}kg

Clip duration: ${clipDurationS.toFixed(1)}s | Frames analyzed: ${frameCount}${isShortClip ? " (SHORT CLIP — limited sample, lower confidence)" : ""}

Biomechanics recorded:
- Peak speed: ${kinematics?.metadata?.peak_speed_ms?.toFixed(2) ?? "N/A"} m/s (method: ${kinematics?.metadata?.speed_method ?? "N/A"})
- Mean speed: ${kinematics?.metadata?.mean_speed_ms?.toFixed(2) ?? "N/A"} m/s
- Strides detected: ${kinematics?.metadata?.stride_count ?? "N/A"}
- Dominant side (by stride count): ${kinematics?.metadata?.dominant_foot ?? "N/A"}

Injury risk flags: Overall ${injuryRisk?.overall?.level ?? "N/A"} | ACL: ${injuryRisk?.risk_categories?.acl_knee?.level ?? "N/A"} | Hamstring: ${injuryRisk?.risk_categories?.hamstring?.level ?? "N/A"} | Ankle: ${injuryRisk?.risk_categories?.ankle?.level ?? "N/A"}

Movement events: ${JSON.stringify(highlights)}

${previousSession ? `Previous session reference: Peak speed ${previousSession.peakSpeedMs?.toFixed(2) ?? "N/A"} m/s | Risk: ${previousSession.overallRisk ?? "N/A"} | Strides: ${previousSession.strideCount ?? "N/A"}` : "No previous session."}

Respond in JSON only (no markdown):
{
  "summary": "2-3 sentences describing what the data shows. Use measured language. Note if the clip is too short for high-confidence conclusions.",
  "moves": ["3-5 observable movement patterns described factually from the biomechanical data — not tactical assumptions"],
  "suggestions": ["3-4 training suggestions directly tied to the specific data values above"],
  "comparison": "${previousSession ? "1-2 factual sentences comparing recorded values to the previous session" : ""}"
}`;

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? `AI analysis failed (${response.status})`);
  }

  return response.json();
}

export default function AnalyzePage() {
  const { profile, sessions, addSession } = useProfile();
  const [file,          setFile]          = useState<File | null>(null);
  const [clipName,      setClipName]      = useState("");
  const [status,        setStatus]        = useState<Status>("idle");
  const [statusMsg,     setStatusMsg]     = useState("");
  const [progress,      setProgress]      = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart,     setTrimStart]     = useState(0);
  const [trimEnd,       setTrimEnd]       = useState(0);
  const [targetX,       setTargetX]       = useState<number | null>(null);
  const [targetY,       setTargetY]       = useState<number | null>(null);
  const [markerPct,     setMarkerPct]     = useState<number | null>(null);
  const [pickMode,      setPickMode]      = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [result,        setResult]        = useState<AnalysisSession | null>(null);
  const [summaryOpen,   setSummaryOpen]   = useState(false);
  const [movesOpen,     setMovesOpen]     = useState(false);
  const [suggestOpen,   setSuggestOpen]   = useState(false);
  const [renamingClip,  setRenamingClip]  = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const videoUrl   = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);

  // ── Canvas overlay drawing ──────────────────────────────────────────────────
  function drawSkeleton(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, color: string, now: number) {
    const sway = Math.sin(now * 0.0015) * scale * 0.04;
    const joints: Record<string, [number, number]> = {
      head:      [sway * 0.3,       -scale * 1.12],
      neck:      [sway * 0.2,       -scale * 0.88],
      lShoulder: [-scale * 0.28 + sway, -scale * 0.72],
      rShoulder: [ scale * 0.28 + sway, -scale * 0.72],
      lElbow:    [-scale * 0.40,    -scale * 0.40],
      rElbow:    [ scale * 0.40,    -scale * 0.40],
      lWrist:    [-scale * 0.34,    -scale * 0.10],
      rWrist:    [ scale * 0.34,    -scale * 0.10],
      lHip:      [-scale * 0.15,     0],
      rHip:      [ scale * 0.15,     0],
      lKnee:     [-scale * 0.18,     scale * 0.46],
      rKnee:     [ scale * 0.18,     scale * 0.46],
      lAnkle:    [-scale * 0.16,     scale * 0.88],
      rAnkle:    [ scale * 0.16,     scale * 0.88],
    };
    const bones: [string, string][] = [
      ["head","neck"],
      ["neck","lShoulder"],["neck","rShoulder"],
      ["neck","lHip"],["neck","rHip"],
      ["lShoulder","lElbow"],["lElbow","lWrist"],
      ["rShoulder","rElbow"],["rElbow","rWrist"],
      ["lHip","rHip"],
      ["lHip","lKnee"],["lKnee","lAnkle"],
      ["rHip","rKnee"],["rKnee","rAnkle"],
    ];
    // Glow pass
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.85;
    bones.forEach(([a, b]) => {
      const [ax, ay] = joints[a]; const [bx, by] = joints[b];
      ctx.beginPath(); ctx.moveTo(cx + ax, cy + ay); ctx.lineTo(cx + bx, cy + by); ctx.stroke();
    });
    // Joints
    ctx.shadowBlur = 0;
    Object.entries(joints).forEach(([name, [jx, jy]]) => {
      const r = name === "head" ? 7 : 3.5;
      ctx.beginPath(); ctx.arc(cx + jx, cy + jy, r, 0, Math.PI * 2);
      ctx.fillStyle = name === "head" ? "rgba(255,255,255,0.95)" : color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  function drawOverlay() {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) { animRef.current = requestAnimationFrame(drawOverlay); return; }
    canvas.width  = video.offsetWidth;
    canvas.height = video.offsetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { animRef.current = requestAnimationFrame(drawOverlay); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (markerPct === null) { animRef.current = requestAnimationFrame(drawOverlay); return; }

    // Athlete position
    const cx = (markerPct / 100) * canvas.width;
    const markerY = targetY !== null ? targetY * canvas.height : canvas.height * 0.55;
    const cy = markerY;

    // Get current speed from kinematics
    let currentSpeed = 0;
    const sess = result;
    if (sess?.kinematics?.timestamp_ms && sess.kinematics.ankle_speed_ms) {
      const tMs = video.currentTime * 1000;
      let closest = 0; let minDiff = Infinity;
      (sess.kinematics.timestamp_ms as number[]).forEach((t, i) => {
        const d = Math.abs(t - tMs); if (d < minDiff) { minDiff = d; closest = i; }
      });
      currentSpeed = (sess.kinematics.ankle_speed_ms as number[])[closest] ?? 0;
    } else if (sess?.peakSpeedMs) {
      currentSpeed = sess.peakSpeedMs * 0.85;
    }

    const color = currentSpeed >= 7.5 ? "#F97316" : currentSpeed >= 6 ? "#FBBF24" : "#10B981";
    const now   = Date.now();
    const pulse = (Math.sin(now * 0.004) + 1) / 2;

    // Skeleton (scale ~1/5 of canvas height)
    const skeletonScale = canvas.height * 0.18;
    drawSkeleton(ctx, cx, cy - skeletonScale * 0.1, skeletonScale, color, now);

    // Pulsing tracking ring at feet
    const feetY = cy + skeletonScale * 0.88;
    const ringR = 18 + pulse * 6;
    ctx.beginPath(); ctx.ellipse(cx, feetY, ringR, ringR * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.25 + pulse * 0.45; ctx.stroke();
    ctx.globalAlpha = 1;

    // Speed HUD badge
    const hudY = cy - skeletonScale * 1.28;
    const speedTxt = currentSpeed > 0 ? `${currentSpeed.toFixed(2)} m/s` : sess?.peakSpeedMs ? `${sess.peakSpeedMs.toFixed(2)} m/s` : "— m/s";
    const badgeW = 84; const badgeH = 26;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath(); (ctx as any).roundRect(cx - badgeW / 2, hudY - badgeH / 2, badgeW, badgeH, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = color; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(speedTxt, cx, hudY);
    // Connector
    ctx.beginPath(); ctx.moveTo(cx, hudY + badgeH / 2); ctx.lineTo(cx, cy - skeletonScale * 1.12 - 8);
    ctx.strokeStyle = `${color}55`; ctx.lineWidth = 1; ctx.stroke();

    animRef.current = requestAnimationFrame(drawOverlay);
  }

  useEffect(() => {
    if (overlayEnabled && (markerPct !== null || result)) {
      animRef.current = requestAnimationFrame(drawOverlay);
    } else {
      cancelAnimationFrame(animRef.current);
      const canvas = canvasRef.current;
      if (canvas) { const ctx = canvas.getContext("2d"); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
    }
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayEnabled, markerPct, result]);

  // ── Capture thumbnail ──────────────────────────────────────────────────────
  function captureThumbnail(): string | undefined {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return undefined;
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = 480;
      canvas.height = Math.round(480 * (v.videoHeight / v.videoWidth)) || 270;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.75);
    } catch {
      return undefined;
    }
  }
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  // Force dark mode on this page
  useEffect(() => {
    const saved = localStorage.getItem("kickiq_theme");
    if (saved !== "light") document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Fake progress animation
  useEffect(() => {
    if (status === "uploading") {
      setProgress(0);
      const t = setInterval(() => setProgress(p => Math.min(p + 2, 60)), 200);
      return () => clearInterval(t);
    }
    if (status === "analyzing_ai") {
      const t = setInterval(() => setProgress(p => Math.min(p + 1.5, 95)), 300);
      return () => clearInterval(t);
    }
    if (status === "success") setProgress(100);
  }, [status]);

  // Sync trim sliders with video playhead
  function handleVideoTimeUpdate() {
    const v = videoRef.current; if (!v) return;
    if (v.currentTime >= trimEnd) { v.pause(); v.currentTime = trimEnd; }
    if (v.currentTime < trimStart) v.currentTime = trimStart;
  }

  // Click on video to pick athlete — capture both X and Y
  function handleVideoClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!pickMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    setTargetX(x);
    setTargetY(y);
    setMarkerPct(x * 100);
    setPickMode(false);
    videoRef.current?.pause();
  }

  async function trimVideo(file: File, startS: number, endS: number): Promise<File> {
    if (startS <= 0.1 && endS >= videoDuration - 0.1) return file;
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.src = url; video.muted = true;
      video.addEventListener("loadedmetadata", () => {
        const end = Math.min(endS, video.duration), start = Math.max(0, startS);
        const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
        if (!stream) { URL.revokeObjectURL(url); resolve(file); return; }
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          URL.revokeObjectURL(url);
          resolve(new File([new Blob(chunks, { type: "video/webm" })],
            file.name.replace(/\.[^.]+$/, "_trimmed.webm"), { type: "video/webm" }));
        };
        recorder.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        video.currentTime = start;
        video.addEventListener("seeked", () => {
          recorder.start(); video.play();
          const t = setInterval(() => {
            if (video.currentTime >= end) { clearInterval(t); video.pause(); recorder.stop(); }
          }, 100);
        }, { once: true });
      });
      video.addEventListener("error", () => { URL.revokeObjectURL(url); resolve(file); });
      video.load();
    });
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading"); setStatusMsg("Preparing video…"); setResult(null);

    const fileToUpload = await trimVideo(file, trimStart, trimEnd);
    const formData = new FormData();
    formData.append("video", fileToUpload);
    if (profile.heightCm) formData.append("height_cm", profile.heightCm);
    if (profile.weightKg) formData.append("weight_kg", profile.weightKg);
    if (targetX !== null) formData.append("target_x", targetX.toFixed(3));

    try {
      setStatusMsg("Extracting pose & computing kinematics…");
      const res  = await fetch(`${API_BASE}/upload-video`, { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) { setStatus("error"); setStatusMsg(data.error ?? "Analysis failed."); return; }

      setStatus("analyzing_ai"); setStatusMsg("Running AI analysis…");

      const ph = data.performance_highlights ?? {};
      const highlights: AnalysisSession["highlights"] = [];
      if (ph.strongest_sprint)  highlights.push({ timestamp_s: ph.strongest_sprint.timestamp_s,  label: "Strongest Sprint",  value: `${ph.strongest_sprint.peak_speed_ms?.toFixed(2)} m/s` });
      if (ph.peak_stride_power) highlights.push({ timestamp_s: ph.peak_stride_power.timestamp_s, label: "Peak Stride Power", value: `${ph.peak_stride_power.peak_torque_nm?.toFixed(0)} N·m` });
      if (ph.quickest_turn)     highlights.push({ timestamp_s: ph.quickest_turn.timestamp_s,     label: "Quickest Turn",     value: `${ph.quickest_turn.lateral_acceleration_ms2?.toFixed(1)} m/s²` });

      let gemini = { summary: "", moves: [] as string[], suggestions: [] as string[], comparison: "" };
      try { gemini = await runGeminiAnalysis(data.cleaned_kinematics, data.injury_risk, ph, profile, sessions[0] ?? null); }
      catch { gemini.summary = "Biomechanical analysis complete."; }

      const asymArr = data.cleaned_kinematics?.torque_asymmetry_pct?.filter((v: any) => v != null) ?? [];
      const meanAsym = asymArr.length ? asymArr.reduce((a: number, b: number) => a + b, 0) / asymArr.length : null;

      const thumbnail = captureThumbnail();

      const session: AnalysisSession = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        thumbnail,
        videoName: clipName || file.name.replace(/\.[^.]+$/, ""),
        videoDuration: data.cleaned_kinematics?.timestamp_ms?.slice(-1)[0] / 1000 ?? videoDuration,
        geminiSummary: gemini.summary,
        movesIdentified: gemini.moves,
        trainingSuggestions: gemini.suggestions,
        comparisonToLast: gemini.comparison || undefined,
        peakSpeedMs:  data.cleaned_kinematics?.metadata?.peak_speed_ms,
        meanSpeedMs:  data.cleaned_kinematics?.metadata?.mean_speed_ms,
        strideCount:  data.cleaned_kinematics?.metadata?.stride_count,
        peakTorqueNm: data.performance_highlights?.peak_stride_power?.peak_torque_nm,
        symmetryScore: meanAsym != null ? Math.max(0, 100 - meanAsym) : undefined,
        dominantFoot: data.cleaned_kinematics?.metadata?.dominant_foot,
        overallRisk: data.injury_risk?.overall?.level,
        overallRiskScore: data.injury_risk?.overall?.score,
        highlights,
        kinematics: data.cleaned_kinematics,
        injuryRisk: data.injury_risk,
      };

      addSession(session);
      setResult(session);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Network error.");
    }
  }

  const isProcessing = status === "uploading" || status === "analyzing_ai";

  const riskColor = (r?: string) =>
    r === "low" ? "#10B981" : r === "moderate" ? "#F59E0B" : r === "high" ? "#EF4444" : "#6B7280";

  return (
    <main style={{ minHeight: "100vh", background: "#0A0F0D", position: "relative", fontFamily: "var(--font-body)" }}>

      {/* Subtle aurora */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-15%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(10,15,13,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "var(--font-display)" }}>K</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "white", letterSpacing: "0.1em" }}>KICKIQ</span>
          </Link>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>Analyze Video</span>
          <ThemeToggle />
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 80px", position: "relative", zIndex: 1 }}>

        {/* ── SUCCESS RESULTS ── */}
        {status === "success" && result && (
          <div style={{ animation: "fadeUp 0.4s ease forwards" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 8px 20px rgba(5,150,105,0.4)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "white" }}>{result.videoName}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Analysis complete · {result.videoDuration.toFixed(0)}s clip</p>
              </div>
            </div>

            {/* Key metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {result.peakSpeedMs && (
                <div style={{ background: "rgba(5,150,105,0.12)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 16, padding: "18px 12px", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, color: "#10B981", lineHeight: 1 }}>{result.peakSpeedMs.toFixed(1)}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>m/s peak</p>
                </div>
              )}
              {result.strideCount && (
                <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: "18px 12px", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, color: "white", lineHeight: 1 }}>{result.strideCount}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>strides</p>
                </div>
              )}
              {result.overallRisk && (
                <div style={{ background: `rgba(${result.overallRisk === "low" ? "16,185,129" : result.overallRisk === "moderate" ? "245,158,11" : "239,68,68"},0.1)`, border: `1px solid rgba(${result.overallRisk === "low" ? "16,185,129" : result.overallRisk === "moderate" ? "245,158,11" : "239,68,68"},0.25)`, borderRadius: 16, padding: "18px 12px", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, color: riskColor(result.overallRisk), lineHeight: 1, textTransform: "capitalize" }}>{result.overallRisk}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>risk</p>
                </div>
              )}
            </div>

            {/* Expandable summary */}
            {result.geminiSummary && (
              <div style={{ background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.18)", borderRadius: 16, padding: "16px 18px", marginBottom: 12 }}>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
                  {summaryOpen ? result.geminiSummary : result.geminiSummary.split(". ").slice(0, 1).join(". ") + "."}
                </p>
                {result.geminiSummary.split(". ").length > 1 && (
                  <button onClick={() => setSummaryOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", color: "#10B981", fontSize: 12, fontWeight: 700, marginTop: 8, padding: 0 }}>
                    {summaryOpen ? "Show less ▲" : "Read more ▼"}
                  </button>
                )}
              </div>
            )}

            {/* Moves — expandable */}
            {result.movesIdentified && result.movesIdentified.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
                <button onClick={() => setMovesOpen(o => !o)} style={{ width: "100%", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Movement Patterns</span>
                  <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>{movesOpen ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {movesOpen && (
                  <div style={{ padding: "0 18px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.movesIdentified.map(m => (
                      <span key={m} style={{ fontSize: 11, fontWeight: 700, background: "rgba(5,150,105,0.15)", color: "#10B981", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 100, padding: "5px 13px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Training suggestions — expandable */}
            {result.trainingSuggestions && result.trainingSuggestions.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
                <button onClick={() => setSuggestOpen(o => !o)} style={{ width: "100%", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Training Suggestions</span>
                  <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>{suggestOpen ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {suggestOpen && (
                  <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.trainingSuggestions.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(5,150,105,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                          <span style={{ color: "#10B981", fontSize: 11, fontWeight: 900 }}>→</span>
                        </div>
                        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/profile" style={{ flex: 1, padding: "14px 0", borderRadius: 14, background: "linear-gradient(135deg,#059669,#0D9488)", color: "white", fontWeight: 700, fontSize: 15, textAlign: "center", textDecoration: "none", boxShadow: "0 8px 24px rgba(5,150,105,0.35)" }}>
                View Profile →
              </Link>
              <button onClick={() => { setStatus("idle"); setFile(null); setResult(null); setProgress(0); setTargetX(null); setTargetY(null); setMarkerPct(null); setClipName(""); setSummaryOpen(false); setMovesOpen(false); setSuggestOpen(false); }}
                style={{ padding: "14px 20px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                New Analysis
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOAD FORM ── */}
        {status !== "success" && (
          <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Profile tip */}
            {!profile.heightCm && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                  <Link href="/profile" style={{ fontWeight: 700, color: "#FBBF24" }}>Add height & weight</Link> for better accuracy
                </p>
              </div>
            )}

            {/* ── VIDEO PREVIEW / FILE PICKER ── */}
            {!file ? (
              /* Drop zone */
              <div onClick={() => inputRef.current?.click()}
                style={{ borderRadius: 20, border: "2px dashed rgba(5,150,105,0.3)", background: "rgba(5,150,105,0.05)", padding: "60px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(5,150,105,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                </div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "white", marginBottom: 8 }}>Choose Your Video</p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>MP4, MOV, AVI, WebM</p>
              </div>
            ) : (
              /* Video preview card */
              <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "#0E1410" }}>

                {/* Video + canvas overlay */}
                <div style={{ position: "relative", cursor: pickMode ? "crosshair" : "default" }} onClick={handleVideoClick}>
                  <video
                    ref={videoRef}
                    src={videoUrl!}
                    controls
                    onTimeUpdate={handleVideoTimeUpdate}
                    onLoadedMetadata={e => {
                      const d = (e.target as HTMLVideoElement).duration;
                      setVideoDuration(d);
                      setTrimEnd(d);
                    }}
                    style={{ width: "100%", display: "block", maxHeight: 360, background: "#000", pointerEvents: pickMode ? "none" : "auto" }}
                  />
                  {/* Canvas skeleton/HUD overlay */}
                  <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }} />

                  {/* Pick mode UI */}
                  {pickMode && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none" }}>
                      {/* Scanline grid */}
                      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(16,185,129,0.06) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(16,185,129,0.06) 40px)" }} />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)" }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ background: "rgba(5,15,10,0.88)", border: "1px solid rgba(16,185,129,0.45)", borderRadius: 14, padding: "14px 22px", textAlign: "center", backdropFilter: "blur(8px)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
                            <p style={{ color: "#10B981", fontWeight: 800, fontSize: 14, letterSpacing: "0.04em" }}>TAP TO LOCK ATHLETE</p>
                          </div>
                          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Pause first for best precision</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls bar */}
                <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Row 1: rename + overlay toggle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {renamingClip ? (
                      <input autoFocus value={clipName} onChange={e => setClipName(e.target.value)}
                        onBlur={() => setRenamingClip(false)} onKeyDown={e => e.key === "Enter" && setRenamingClip(false)}
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(5,150,105,0.4)", borderRadius: 9, padding: "8px 12px", color: "white", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "var(--font-display)" }} />
                    ) : (
                      <p style={{ flex: 1, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {clipName || file.name.replace(/\.[^.]+$/, "")}
                      </p>
                    )}
                    <button type="button" onClick={() => { if (!renamingClip) setClipName(clipName || file.name.replace(/\.[^.]+$/, "")); setRenamingClip(r => !r); }}
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      {renamingClip ? "Done" : "Rename"}
                    </button>
                    {/* Data Overlay toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Overlay</span>
                      <button type="button" onClick={() => setOverlayEnabled(v => !v)} style={{ position: "relative", width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: overlayEnabled ? "#059669" : "rgba(255,255,255,0.1)", transition: "background 0.2s", flexShrink: 0 }}>
                        <span style={{ position: "absolute", top: 2, left: overlayEnabled ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", transition: "left 0.2s" }} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Athlete selection */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button type="button"
                      onClick={() => { setPickMode(p => !p); if (!pickMode) videoRef.current?.pause(); }}
                      style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${pickMode ? "rgba(16,185,129,0.55)" : markerPct !== null ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`, background: pickMode ? "rgba(16,185,129,0.12)" : markerPct !== null ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.04)", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${markerPct !== null ? "#10B981" : "rgba(255,255,255,0.3)"}`, background: markerPct !== null ? "rgba(16,185,129,0.2)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {markerPct !== null && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />}
                      </div>
                      <span style={{ color: pickMode ? "#10B981" : markerPct !== null ? "#34D399" : "rgba(255,255,255,0.5)" }}>
                        {pickMode ? "Tap athlete in frame ↑" : markerPct !== null ? "Athlete locked — tap to reselect" : "Select athlete to track"}
                      </span>
                    </button>
                    {markerPct !== null && (
                      <button type="button" onClick={() => { setTargetX(null); setTargetY(null); setMarkerPct(null); }}
                        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer" }}>
                        Clear
                      </button>
                    )}
                  </div>
                  {markerPct === null && !pickMode && (
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: -4 }}>Optional — pause &amp; tap to lock onto a specific player. Skeleton &amp; HUD overlays update in real time.</p>
                  )}
                </div>

                {/* File info row */}
                <div style={{ padding: "10px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{(file.size/1024/1024).toFixed(1)} MB</span>
                  <button type="button" onClick={() => { setFile(null); setClipName(""); setTargetX(null); setTargetY(null); setMarkerPct(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 600 }}>
                    Remove video
                  </button>
                </div>
              </div>
            )}

            <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm" style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setFile(f); setStatus("idle"); setResult(null);
                setTargetX(null); setTargetY(null); setMarkerPct(null);
                if (f) setClipName(f.name.replace(/\.[^.]+$/, ""));
              }} disabled={isProcessing} />

            {/* ── Trim controls ── */}
            {file && videoDuration > 0 && (
              <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Trim Video</p>
                  <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(5,150,105,0.15)", color: "#10B981", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 100, padding: "3px 10px" }}>{(trimEnd-trimStart).toFixed(1)}s selected</span>
                </div>
                <div style={{ position: "relative", height: 36, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
                  <div style={{ position: "absolute", top: 0, height: "100%", background: "rgba(5,150,105,0.2)", borderLeft: "2px solid #059669", borderRight: "2px solid #0D9488", left: `${(trimStart/videoDuration)*100}%`, width: `${((trimEnd-trimStart)/videoDuration)*100}%` }} />
                  <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 6px" }}>
                    {[0,.25,.5,.75,1].map(p => <span key={p} style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>{(p*videoDuration).toFixed(0)}s</span>)}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Start</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>{trimStart.toFixed(1)}s</span>
                    </div>
                    <input type="range" min={0} max={videoDuration} step={0.1} value={trimStart} onChange={e => { const v = Math.min(parseFloat(e.target.value), trimEnd-0.5); setTrimStart(v); if (videoRef.current) videoRef.current.currentTime = v; }} style={{ width: "100%", accentColor: "#059669" }} />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>End</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981" }}>{trimEnd.toFixed(1)}s</span>
                    </div>
                    <input type="range" min={0} max={videoDuration} step={0.1} value={trimEnd} onChange={e => { const v = Math.max(parseFloat(e.target.value), trimStart+0.5); setTrimEnd(v); if (videoRef.current) videoRef.current.currentTime = v; }} style={{ width: "100%", accentColor: "#059669" }} />
                  </div>
                </div>
                <button type="button" onClick={() => { setTrimStart(0); setTrimEnd(videoDuration); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.2)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reset</button>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "20px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid #059669", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: "white", fontSize: 14 }}>{statusMsg}</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>This may take 30–60 seconds</p>
                  </div>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 100, background: "linear-gradient(90deg,#059669,#0D9488,#06B6D4)", transition: "width 0.5s ease", width: `${progress}%` }} />
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "right", marginTop: 6, fontWeight: 600 }}>{Math.round(progress)}%</p>
              </div>
            )}

            {status === "error" && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "14px 18px" }}>
                <p style={{ color: "#FCA5A5", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  {statusMsg.includes("fetch") || statusMsg.includes("Load failed") || statusMsg.includes("Network")
                    ? "Backend offline — make sure the analysis server is running on localhost:8000"
                    : `Error: ${statusMsg}`}
                </p>
                <p style={{ color: "rgba(255,100,100,0.5)", fontSize: 12 }}>
                  {statusMsg.includes("fetch") || statusMsg.includes("Load failed") || statusMsg.includes("Network")
                    ? "Run: cd soccer-biomechanics-ai && python main.py"
                    : "Check your connection and try again."}
                </p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={!file || isProcessing}
              style={{ width: "100%", padding: "18px 0", borderRadius: 16, background: file && !isProcessing ? "linear-gradient(135deg,#059669,#0D9488)" : "rgba(255,255,255,0.07)", color: file && !isProcessing ? "white" : "rgba(255,255,255,0.2)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "0.02em", cursor: file && !isProcessing ? "pointer" : "not-allowed", border: "none", boxShadow: file && !isProcessing ? "0 12px 32px rgba(5,150,105,0.35)" : "none", transition: "all 0.2s" }}>
              {isProcessing ? "Analyzing…" : "Analyze Video →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
