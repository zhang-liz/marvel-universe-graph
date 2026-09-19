import type { Metadata } from "next";
import { Bangers, Comic_Neue } from "next/font/google";
import "./globals.css";

const bangers = Bangers({ weight: "400", subsets: ["latin"], variable: "--font-bangers" });
const comic = Comic_Neue({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-comic" });

export const metadata: Metadata = {
  title: "Marvel Universe Graph",
  description: "Explore the Marvel Cinematic Universe as a graph. Click a hero, follow the links, ask questions. Powered by FalkorDB.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bangers.variable} ${comic.variable}`}>
      <body suppressHydrationWarning>{children}</body>{/* browser extensions (Grammarly, ...) add attributes to body */}
    </html>
  );
}
