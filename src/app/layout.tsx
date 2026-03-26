import type { Metadata } from "next";
import { Syne, Outfit } from "next/font/google";
import "./globals.css";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ThemeProvider } from "@/components/ThemeProvider";

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "KickIQ — Athlete Intelligence",
  description: "AI-powered biomechanical analysis and recruiting profile for soccer athletes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${outfit.variable}`}>
      <body>
        <ThemeProvider>
          <ProfileProvider>
            {children}
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
