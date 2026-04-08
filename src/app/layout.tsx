import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/auth/Providers";
import AppSidebar from "@/components/layout/AppSidebar";
import NavigationProgress from "@/components/layout/NavigationProgress";
import "./globals.css";
import "highlight.js/styles/github.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Teams Squared Docs",
  description: "Internal documentation portal for Teams Squared",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-row bg-[#f5f5f8] dark:bg-[#0f0f14]">
        <Providers>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto pt-14 md:pt-0">
            <NavigationProgress />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
