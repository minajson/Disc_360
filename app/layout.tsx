import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Disc360 — Personality Intelligence Platform",
    template: "%s · Disc360",
  },
  description:
    "Decode how people lead, communicate, decide, and respond under pressure. DISC assessment and team intelligence for individuals, coaches, and organizations.",
  openGraph: {
    title: "Disc360 — Personality Intelligence Platform",
    description:
      "Decode how people lead, communicate, decide, and respond under pressure. Profiles across four dimensions: Dominant, Influence, Stable, Analytical.",
    siteName: "Disc360",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Disc360 — Personality Intelligence Platform",
    description:
      "Decode how people lead, communicate, decide, and respond under pressure.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-midnight-950 text-ink">
        {children}
      </body>
    </html>
  );
}
