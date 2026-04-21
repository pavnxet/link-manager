import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Link Vault Web",
  description: "Private cloud-native personal link manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
