import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://link-manager-lake.vercel.app").replace(/\/$/, "");

const DESCRIPTION =
  "Link Vault is a private, self-hosted link manager and image vault. Save links with automatic " +
  "title scraping and categorisation, and upload screenshots by drag-and-drop, paste or camera to " +
  "ImgBB — backed by Turso or Supabase.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Link Vault",
  title: {
    default: "Link Vault — self-hosted link manager with image hosting",
    template: "%s · Link Vault",
  },
  description: DESCRIPTION,
  keywords: [
    "link manager",
    "bookmark manager",
    "personal knowledge base",
    "read later app",
    "self-hosted bookmarks",
    "image hosting",
    "ImgBB upload",
    "Next.js",
    "Turso",
    "Supabase",
  ],
  authors: [{ name: "pavnxet", url: "https://github.com/pavnxet" }],
  creator: "pavnxet",
  publisher: "pavnxet",
  category: "productivity",
  alternates: { canonical: "/" },
  // A private vault should not be indexed, but shared links should still preview properly.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  openGraph: {
    type: "website",
    siteName: "Link Vault",
    title: "Link Vault — self-hosted link manager with image hosting",
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Link Vault dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Link Vault — self-hosted link manager with image hosting",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: "Link Vault", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
