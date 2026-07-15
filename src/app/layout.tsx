import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Running Fueling Calculator",
  description: "Plan fueling and hydration for your next run.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="emerald">
      <body>{children}</body>
    </html>
  );
}
