"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile, AthleteProfile } from "@/contexts/ProfileContext";
import Link from "next/link";
import { useRef } from "react";

const POSITIONS = ["Goalkeeper","Defender","Center Back","Full Back","Midfielder",
  "Defensive Mid","Central Mid","Attacking Mid","Winger","Forward","Striker"];
const LEAGUES   = ["MLS","NWSL","NCAA D1","NCAA D2","NCAA D3","NAIA","USL","Liga MX",
  "Premier League","La Liga","Bundesliga","Serie A","Other"];
const YEARS     = ["Freshman","Sophomore","Junior","Senior","Graduate","Professional","Youth Academy"];

const STEPS = [
  { id: 1, label: "Personal",  icon: "👤" },
  { id: 2, label: "Soccer",    icon: "⚽" },
  { id: 3, label: "Stats",     icon: "📊" },
  { id: 4, label: "Done",      icon: "✓"  },
];

export default function SetupPage() {
  const { setProfile, profile } = useProfile();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const ic = "w-full bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-900 outline-none transition-all focus:border-[#00C853] placeholder-gray-400";
  const lc = "block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide";
  const sc = "w-full bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-900 outline-none transition-all focus:border-[#00C853]";

  function f(key: keyof AthleteProfile, label: string, placeholder?: string, type = "text") {
    return (
      <div>
        <label className={lc}>{label}</label>
        <input type={type} value={profile[key] as string || ""}
          onChange={e => setProfile({ [key]: e.target.value } as any)}
          placeholder={placeholder} className={ic} />
      </div>
    );
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => setProfile({ photoUrl: r.result as string });
    r.readAsDataURL(file);
  }

  function finish() {
    router.push("/profile");
  }

  return (
    <main className="min-h-screen bg-[#F8F7F4]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00C853] flex items-center justify-center">
              <span className="text-white font-black text-sm font-display">K</span>
            </div>
            <span className="font-display text-xl font-bold text-gray-900">KICKIQ</span>
          </Link>
          <p className="text-sm text-gray-400 font-medium">Step {step} of 3</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Progress bar */}
        <div className="flex gap-2 mb-10">
          {[1,2,3].map(s => (
            <div key={s} className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: step >= s ? "100%" : "0%", background: "#00C853" }} />
            </div>
          ))}
        </div>

        {/* Step 1: Personal */}
        {step === 1 && (
          <div className="space-y-6 animate-up">
            <div>
              <h1 className="font-display text-5xl font-black text-gray-900 mb-2">Who are you?</h1>
              <p className="text-gray-500 text-lg">Set up your basic info. This is what recruiters will see first.</p>
            </div>

            {/* Photo upload — big and prominent */}
            <div className="flex flex-col items-center gap-4 py-6">
              <div onClick={() => fileRef.current?.click()}
                className="w-32 h-32 rounded-3xl overflow-hidden cursor-pointer transition-all hover:scale-105"
                style={{
                  background: profile.photoUrl ? "transparent" : "linear-gradient(135deg, #E8F5E9, #F0FFF4)",
                  border: "3px dashed #A5D6A7",
                  boxShadow: profile.photoUrl ? "0 12px 40px rgba(0,0,0,0.15)" : "none"
                }}>
                {profile.photoUrl
                  ? <img src={profile.photoUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <span className="text-4xl">📸</span>
                      <span className="text-xs font-bold text-[#00C853]">Add Photo</span>
                    </div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              <p className="text-sm text-gray-400">Tap to upload your photo</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {f("name",        "Full Name",   "e.g. Alex Johnson")}
              {f("age",         "Age",         "18", "number")}
              {f("nationality", "Nationality", "e.g. USA")}
              {f("location",    "Location",    "Los Angeles, CA")}
            </div>
            <div>
              <label className={lc}>Bio</label>
              <textarea value={profile.bio} onChange={e => setProfile({ bio: e.target.value })}
                placeholder="Tell recruiters your story... What makes you different?"
                rows={4} className="w-full bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 text-base text-gray-900 outline-none transition-all focus:border-[#00C853] resize-none placeholder-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {f("email",     "Email",     "your@email.com", "email")}
              {f("instagram", "Instagram", "@handle")}
            </div>
          </div>
        )}

        {/* Step 2: Soccer */}
        {step === 2 && (
          <div className="space-y-6 animate-up">
            <div>
              <h1 className="font-display text-5xl font-black text-gray-900 mb-2">Your game</h1>
              <p className="text-gray-500 text-lg">Tell us about your soccer background and physical stats.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Primary Position</label>
                <select value={profile.primaryPosition} onChange={e => setProfile({ primaryPosition: e.target.value })} className={sc}>
                  <option value="">Select…</option>
                  {POSITIONS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={lc}>Secondary Position</label>
                <select value={profile.secondaryPosition} onChange={e => setProfile({ secondaryPosition: e.target.value })} className={sc}>
                  <option value="">Select…</option>
                  {POSITIONS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {f("currentClub",  "Current Club",   "FC United")}
              {f("yearsPlaying", "Years Playing",  "8", "number")}
              {f("heightCm",     "Height (cm)",    "175", "number")}
              {f("weightKg",     "Weight (kg)",    "70", "number")}
            </div>

            <div>
              <label className={lc}>Dominant Foot</label>
              <div className="grid grid-cols-3 gap-3">
                {(["left","right","both"] as const).map(foot => (
                  <button key={foot} type="button" onClick={() => setProfile({ dominantFoot: foot })}
                    className={`py-5 rounded-2xl text-base font-bold capitalize transition border-2 ${
                      profile.dominantFoot === foot
                        ? "border-[#00C853] bg-[#F0FFF4] text-[#007B33]"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}>{foot === "left" ? "⬅️ Left" : foot === "right" ? "Right ➡️" : "Both 🎯"}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lc}>Target League</label>
                <select value={profile.targetLeague} onChange={e => setProfile({ targetLeague: e.target.value })} className={sc}>
                  <option value="">Select…</option>
                  {LEAGUES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={lc}>Academic Year</label>
                <select value={profile.academicYear} onChange={e => setProfile({ academicYear: e.target.value })} className={sc}>
                  <option value="">Select…</option>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-5 border-2 border-gray-200">
              <div>
                <p className="font-bold text-gray-900 text-lg">Open to Recruitment</p>
                <p className="text-gray-500 text-sm mt-1">Let college coaches and scouts find your profile</p>
              </div>
              <button type="button" onClick={() => setProfile({ openToRecruitment: !profile.openToRecruitment })}
                className="relative h-8 w-14 rounded-full transition-all"
                style={{ background: profile.openToRecruitment ? "#00C853" : "#D1D5DB" }}>
                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transform transition-all ${profile.openToRecruitment ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Stats */}
        {step === 3 && (
          <div className="space-y-6 animate-up">
            <div>
              <h1 className="font-display text-5xl font-black text-gray-900 mb-2">Your stats</h1>
              <p className="text-gray-500 text-lg">Add your career or current season statistics. These appear on your profile.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "goals",          l: "Goals",            p: "12" },
                { k: "assists",        l: "Assists",          p: "7"  },
                { k: "appearances",    l: "Appearances",      p: "24" },
                { k: "passCompletion", l: "Pass Completion %", p: "82" },
                { k: "shotsOnTarget",  l: "Shots on Target",  p: "18" },
                { k: "gpa",            l: "GPA (optional)",   p: "3.8" },
              ].map(s => (
                <div key={s.k}>
                  <label className={lc}>{s.l}</label>
                  <input type="number" value={profile[s.k as keyof AthleteProfile] as string || ""}
                    onChange={e => setProfile({ [s.k]: e.target.value } as any)}
                    placeholder={s.p} className={ic} />
                </div>
              ))}
            </div>

            <div className="bg-[#F0FFF4] rounded-3xl p-6 border border-[#C8E6C9]">
              <p className="font-bold text-[#2E7D32] mb-1">🎉 Almost done!</p>
              <p className="text-[#2E7D32]/80 text-sm leading-relaxed">
                After creating your profile, you can add videos and our AI will analyze your biomechanics, identify your moves, and give you personalized training suggestions.
              </p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-4 mt-10">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-lg hover:border-gray-400 transition">
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !profile.name}
              className="flex-1 btn-primary py-5 font-display text-2xl rounded-2xl text-white disabled:opacity-40">
              Continue →
            </button>
          ) : (
            <button onClick={finish}
              className="flex-1 btn-primary py-5 font-display text-2xl rounded-2xl text-white">
              Create Profile ✓
            </button>
          )}
        </div>

        {step === 1 && (
          <p className="text-center text-sm text-gray-400 mt-4">
            Stats and videos can be added later
          </p>
        )}
      </div>
    </main>
  );
}
