import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoFlake",
  description: "Solana-native anti-no-show RSVP layer"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
