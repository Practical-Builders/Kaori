"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InjuryRecord {
  id: string;
  type: string;          // e.g. "Hamstring strain"
  date: string;          // ISO date string
  status: "recovered" | "ongoing" | "monitoring";
  notes?: string;
}

export interface AthleteProfile {
  // Personal
  name: string;
  age: string;
  nationality: string;
  location: string;
  bio: string;
  photoUrl?: string;     // base64 or URL
  // Physical
  heightCm: string;
  weightKg: string;
  dominantFoot: "left" | "right" | "both" | "";
  // Soccer
  primaryPosition: string;
  secondaryPosition: string;
  currentClub: string;
  yearsPlaying: string;
  // Academic
  academicYear: string;
  gpa: string;
  // Recruiting
  openToRecruitment: boolean;
  targetLeague: string;
  email: string;
  instagram: string;
  // Self-reported stats
  goals: string;
  assists: string;
  appearances: string;
  passCompletion: string;
  shotsOnTarget: string;
  // Injury history
  injuries: InjuryRecord[];
}

export interface AnalysisSession {
  id: string;
  date: string;
  videoName: string;
  videoDuration: number;
  thumbnail?: string;
  // Gemini output
  geminiSummary?: string;
  movesIdentified?: string[];
  trainingSuggestions?: string[];
  comparisonToLast?: string;
  // Biomechanics
  peakSpeedMs?: number;
  meanSpeedMs?: number;
  strideCount?: number;
  peakTorqueNm?: number;
  symmetryScore?: number;
  dominantFoot?: string;
  // Injury risk
  overallRisk?: string;
  overallRiskScore?: number;
  // Highlights (timestamp + label)
  highlights?: { timestamp_s: number; label: string; value?: string }[];
  // Raw kinematics (for details view)
  kinematics?: any;
  injuryRisk?: any;
  // Per-frame bounding box track (pixel space, original video dimensions)
  bboxTrack?: Array<{ x0: number; y0: number; x1: number; y1: number } | null>;
  bboxMeta?:  { width: number; height: number };
}

export const DEFAULT_PROFILE: AthleteProfile = {
  name: "", age: "", nationality: "", location: "", bio: "",
  heightCm: "", weightKg: "", dominantFoot: "",
  primaryPosition: "", secondaryPosition: "", currentClub: "", yearsPlaying: "",
  academicYear: "", gpa: "", openToRecruitment: true, targetLeague: "",
  email: "", instagram: "",
  goals: "", assists: "", appearances: "", passCompletion: "", shotsOnTarget: "",
  injuries: [],
};

// ── Context ────────────────────────────────────────────────────────────────────

interface ProfileContextValue {
  profile: AthleteProfile;
  setProfile: (updates: Partial<AthleteProfile>) => void;
  sessions: AnalysisSession[];
  addSession: (session: AnalysisSession) => void;
  removeSession: (id: string) => void;
  profileComplete: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const AUTHED_KEY = "kickiq_authed_email";

function storageKeys() {
  try {
    const email = sessionStorage.getItem(AUTHED_KEY) ?? "guest";
    const safe  = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
    return {
      profile:  `kaori_profile_${safe}`,
      sessions: `kaori_sessions_${safe}`,
    };
  } catch {
    return { profile: "kaori_profile", sessions: "kaori_sessions" };
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile,  setProfileState]  = useState<AthleteProfile>(DEFAULT_PROFILE);
  const [sessions, setSessionsState] = useState<AnalysisSession[]>([]);
  const [loaded,   setLoaded]        = useState(false);

  // Load from localStorage on mount (keyed by authenticated email)
  useEffect(() => {
    try {
      const { profile: pk, sessions: sk } = storageKeys();
      const p = localStorage.getItem(pk);
      const s = localStorage.getItem(sk);
      if (p) setProfileState(JSON.parse(p));
      if (s) setSessionsState(JSON.parse(s));
    } catch {}
    setLoaded(true);
  }, []);

  // Persist profile
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKeys().profile, JSON.stringify(profile)); } catch {}
  }, [profile, loaded]);

  // Persist sessions
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKeys().sessions, JSON.stringify(sessions)); } catch {}
  }, [sessions, loaded]);

  function setProfile(updates: Partial<AthleteProfile>) {
    setProfileState(prev => ({ ...prev, ...updates }));
  }

  function addSession(session: AnalysisSession) {
    setSessionsState(prev => [session, ...prev]);
  }

  function removeSession(id: string) {
    setSessionsState(prev => prev.filter(s => s.id !== id));
  }

  const profileComplete = Boolean(profile.name && profile.primaryPosition);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, sessions, addSession, removeSession, profileComplete }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
