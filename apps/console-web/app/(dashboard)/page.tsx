import { DocumentTable } from "@/components/document-table";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dokumen Saya</h1>
                    <p className="text-slate-500 mt-1">Kelola semua modul ajar yang telah Anda buat.</p>
                </div>
                <Link
                    href="/app/generate"
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm shadow-emerald-200"
                >
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Buat Baru
                </Link>
            </div>

            <DocumentTable />
        </div>
    );
}
