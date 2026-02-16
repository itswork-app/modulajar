'use client';

import { DocumentTable } from "@/components/document-table";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function DashboardPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-7xl mx-auto space-y-8"
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dokumen Saya</h1>
                    <p className="text-slate-500 mt-2 text-lg">Kelola dan pantau semua modul ajar yang telah Anda buat.</p>
                </div>
                <Link
                    href="/generate"
                    className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 hover:-translate-y-0.5 transition-all font-semibold shadow-lg shadow-emerald-200 group"
                >
                    <PlusCircle className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                    Buat Baru
                </Link>
            </div>

            <DocumentTable />
        </motion.div>
    );
}
