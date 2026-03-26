"use client";
import { useState, useEffect } from "react";

const THEME_KEY = "kickiq_theme";

export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem(THEME_KEY, "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(THEME_KEY, "light");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark mode"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 13px", borderRadius: 20, cursor: "pointer",
        background: "var(--input-bg)", border: "1px solid var(--card-border)",
        color: "var(--text-2)", fontSize: 12, fontWeight: 600,
        fontFamily: "var(--font-body)", transition: "all 0.2s",
        ...style,
      }}
    >
      {dark ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          Light
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
          Dark
        </>
      )}
    </button>
  );
}
