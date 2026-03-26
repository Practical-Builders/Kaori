"use client";
import { useEffect } from "react";

const THEME_KEY = "kickiq_theme";

/** Reads the saved theme from localStorage and applies data-theme to <html>.
 *  Defaults to dark if no preference has been saved yet. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    // Default to dark unless the user has explicitly chosen light
    if (saved === "light") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);
  return <>{children}</>;
}
