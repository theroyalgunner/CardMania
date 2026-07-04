import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Card Mania",
  description: "Football card portfolio, AI scanner and collection tracker"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
