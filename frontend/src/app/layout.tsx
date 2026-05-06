import type { Metadata } from "next";
import { WalletProvider } from "../components/wallet-provider";
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
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
