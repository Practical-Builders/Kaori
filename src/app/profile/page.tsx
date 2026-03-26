"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile, AthleteProfile, AnalysisSession } from "@/contexts/ProfileContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const AUTHED_KEY  = "kickiq_authed_email";
const THEME_KEY   = "kickiq_theme";
const POSITIONS = ["Goalkeeper","Defender","Center Back","Full Back","Midfielder",
  "Defensive Mid","Central Mid","Attacking Mid","Winger","Forward","Striker"];
const YEARS = ["Freshman","Sophomore","Junior","Senior","Graduate","Professional","Youth Academy"];

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

// ── Explore content ───────────────────────────────────────────────────────────
const EXPLORE = [
  { cat: "Training", title: "5 Speed Drills for Midfielders", source: "UEFA", url: "https://www.uefa.com/nationalassociations/uefaregulations/technicalreports/", img: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=400&q=80" },
  { cat: "Fitness",  title: "Injury Prevention for Young Athletes", source: "FIFA", url: "https://www.fifa.com/technical/football-medicine/", img: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=400&q=80" },
  { cat: "Tactics",  title: "Pressing Triggers & High Press", source: "FC Barcelona", url: "https://www.fcbarcelona.com/en/football/first-team", img: "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=400&q=80" },
  { cat: "Nutrition","title": "Fueling Performance: Pre-Match Diet", source: "Sports Science", url: "https://www.gssiweb.org/sports-science-exchange/article/sse-180-fueling-for-sport", img: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=400&q=80" },
  { cat: "Recruiting","title":"How College Coaches Find Prospects", source: "NSCAA", url: "https://www.nscaa.com/resources/college-recruiting", img: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=400&q=80" },
  { cat: "Training", title: "Ball Mastery: 15-Min Daily Routine", source: "Coerver", url: "https://www.coerver.com/", img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&q=80" },
];

// ── Session scrub card ─────────────────────────────────────────────────────────
function SessionCard({ session, onRemove, pinned, onPin }: {
  session: AnalysisSession; onRemove: () => void; pinned: boolean; onPin: () => void;
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
            ★
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
  const [activeTab,  setActiveTab]  = useState<"performance"|"explore"|"settings">("performance");
  const [editOpen,   setEditOpen]   = useState(false);
  const [pinnedIds,  setPinnedIds]  = useState<string[]>([]);
  const [isDark,     setIsDark]     = useState(true);
  const router = useRouter();

  // Force dark on mount, auth guard
  useEffect(() => {
    if (!sessionStorage.getItem(AUTHED_KEY)) { router.replace("/login"); return; }
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light") {
      document.documentElement.removeAttribute("data-theme");
      setIsDark(false);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      setIsDark(true);
    }
    const pins = localStorage.getItem("kickiq_pinned");
    if (pins) setPinnedIds(JSON.parse(pins));
  }, []);

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

      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: isDark ? "rgba(10,15,13,0.92)" : "rgba(244,251,248,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", gap: 0 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 32 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontWeight: 900, fontSize: 13, fontFamily: "var(--font-display)" }}>K</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: text1, letterSpacing: "0.1em" }}>KICKIQ</span>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", flex: 1, gap: 0 }}>
            {([
              { id: "performance", label: "Performance" },
              { id: "explore",     label: "Explore"     },
              { id: "settings",    label: "Profile"     },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "0 18px", height: 60, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "none", border: "none", transition: "all 0.15s",
                color: activeTab === t.id ? "#10B981" : text2,
                borderBottom: activeTab === t.id ? "2px solid #059669" : "2px solid transparent",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/analyze" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, borderRadius: 10, color: "white", textDecoration: "none", background: "linear-gradient(135deg,#059669,#0D9488)", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }}>+ Add Video</Link>
            <button onClick={toggleTheme} style={{ padding: "7px 13px", borderRadius: 20, cursor: "pointer", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(5,150,105,0.08)", border: `1px solid ${border}`, color: text2, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {isDark
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>Light</>
                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>Dark</>}
            </button>
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
              {/* Compact identity strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, padding: "20px 24px", background: card, border: `1px solid ${border}`, borderRadius: 18 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", flexShrink: 0, border: `2px solid ${border}` }}>
                  {profile.photoUrl
                    ? <img src={profile.photoUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#059669,#0D9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, color: "white" }}>{profile.name.charAt(0).toUpperCase()}</span>
                      </div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1 }}>{profile.name}</p>
                    {profile.primaryPosition && <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(5,150,105,0.12)", color: "#10B981", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 100, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{profile.primaryPosition}</span>}
                    {profile.openToRecruitment && <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 100, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Open to Recruit</span>}
                  </div>
                  <p style={{ fontSize: 12, color: text2, marginTop: 3 }}>
                    {[profile.currentClub, profile.location, profile.age ? `Age ${profile.age}` : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {/* Quick stats */}
                <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                  {bestSpeed && <div style={{ textAlign: "center" }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "#10B981" }}>{bestSpeed.toFixed(1)}</p><p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>m/s best</p></div>}
                  <div style={{ textAlign: "center" }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1 }}>{sessions.length}</p><p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sessions</p></div>
                  {avgSymmetry && <div style={{ textAlign: "center" }}><p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: text1 }}>{avgSymmetry.toFixed(0)}%</p><p style={{ fontSize: 9, fontWeight: 700, color: text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Symmetry</p></div>}
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
                  {/* ── Top Moments (best per category, all sessions) ── */}
                  {topMoments.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1, marginBottom: 14 }}>Top Moments</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                        {topMoments.slice(0, 3).map((h, i) => (
                          <div key={i} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: "16px 14px" }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{h.label}</p>
                            {h.value && <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: text1 }}>{h.value}</p>}
                            <p style={{ fontSize: 10, color: text2, marginTop: 4 }}>at {h.timestamp_s.toFixed(1)}s</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Moves detected (short pills) ── */}
                  {allMoves.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1, marginBottom: 12 }}>Movement Patterns</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {allMoves.map(m => <span key={m} style={{ fontSize: 12, fontWeight: 700, background: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5", color: "#10B981", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "6px 14px" }}>{m}</span>)}
                      </div>
                    </div>
                  )}

                  {/* ── Pinned sessions ── */}
                  {pinnedSessions.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1, marginBottom: 12 }}>Pinned Sessions <span style={{ fontSize: 12, color: text2, fontWeight: 600 }}>({pinnedSessions.length}/3)</span></p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pinnedSessions.map(s => <SessionCard key={s.id} session={s} onRemove={() => removeSession(s.id)} pinned={true} onPin={() => togglePin(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {/* ── All sessions ── */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: text1 }}>All Sessions <span style={{ fontSize: 13, color: text2, fontWeight: 600 }}>({sessions.length})</span></p>
                      <Link href="/analyze" style={{ fontSize: 13, fontWeight: 700, color: "#10B981", textDecoration: "none" }}>+ Add →</Link>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {sessions.map(s => <SessionCard key={s.id} session={s} onRemove={() => removeSession(s.id)} pinned={pinnedIds.includes(s.id)} onPin={() => togglePin(s.id)} />)}
                    </div>
                  </div>
                </>
              )}
            </>
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
                <button onClick={() => setEditOpen(true)} style={{ width: "100%", padding: "12px", borderRadius: 12, background: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5", border: "1px solid rgba(5,150,105,0.2)", color: "#10B981", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Edit Profile Info →
                </button>
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
        </div>
      )}
    </main>
  );
}
