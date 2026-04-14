import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import Providers from "@/components/auth/Providers";
import NavBar from "@/components/layout/NavBar";
import PostHogPageView from "@/components/analytics/PostHogPageView";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Teams Squared LMS",
  description: "Learning Management System for Teams Squared",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[#f5f5f8] dark:bg-[#0f0f14]">
        <Providers>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <NavBar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
