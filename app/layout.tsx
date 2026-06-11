import type { Metadata } from "next";
import { Bricolage_Grotesque, Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "600", "700", "800"],
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  weight: ["400", "500", "600", "700"],
});

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-spline-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Road to Queenstown — Marathon Coach",
  description:
    "Track your training, watch your fitness build, and forecast your Queenstown Marathon finish time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${bricolage.variable} ${schibsted.variable} ${splineMono.variable} grain`}
      >
        <div className="topo-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
