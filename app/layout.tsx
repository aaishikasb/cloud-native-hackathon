import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const stackText = localFont({
  src: "../public/fonts/StackSansText-Variable.ttf",
  variable: "--font-stack-text",
  weight: "200 700",
  display: "swap",
});

const stackNotch = localFont({
  src: "../public/fonts/StackSansNotch-Variable.ttf",
  variable: "--font-stack-notch",
  weight: "200 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Detour — Good things happen off the agenda",
  description:
    "Find the people you can help, and the people who can help you. A little detour at Cloud Native Hackathon.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${stackText.variable} ${stackNotch.variable}`}>
      <body>{children}</body>
    </html>
  );
}
