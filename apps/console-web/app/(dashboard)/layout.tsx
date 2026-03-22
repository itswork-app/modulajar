'use client';

import { useState } from 'react';
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden relative">
            {/* Sidebar acts as navigation */}
            <Sidebar 
                onClose={() => setIsMobileMenuOpen(false)}
                className={cn(
                    "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out",
                    isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                )} 
            />

            {/* Backdrop for mobile */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header 
                    onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                    isMobileMenuOpen={isMobileMenuOpen}
                />
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
