import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Modulajar HQ | Command Center",
  description: "Platform Operations and Revenue Intelligence",
};

import { motion, AnimatePresence } from "framer-motion";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark scroll-smooth">
        <body className={cn(inter.variable, "antialiased bg-background text-foreground min-h-screen selection:bg-primary/30")}>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 relative">
              {/* Grain / Noise Overlay for texture */}
              <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150" />
              
              {/* Premium Glow Spot */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -mr-48 -mt-48 pointer-events-none" />
              
              <div className="relative z-10 max-w-7xl mx-auto h-full">
                <AnimatePresence mode="wait">
                  {children}
                </AnimatePresence>
              </div>
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
