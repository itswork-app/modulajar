'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Sparkles, Loader2, Database, Search, BookOpen, Star } from 'lucide-react';


const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface DatasetEntry {
    id: string;
    subject: string;
    grade: number;
    topic: string;
    quality_score: number;
    usage_count: number;
    created_at: string;
}

export default function DatasetPage() {
    const { getToken } = useAuth();
    const { workspace } = useWorkspace();
    const [dataset, setDataset] = useState<DatasetEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!workspace?.id) return;
        const fetchDataset = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspace.id}/curriculum/dataset?limit=50`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDataset(data.dataset);
                }
            } catch (err) {
                console.error("Dataset fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDataset();
    }, [workspace?.id, getToken]);

    const filtered = dataset.filter(d => 
        d.subject.toLowerCase().includes(search.toLowerCase()) || 
        d.topic.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Database className="w-8 h-8 text-emerald-600" />
                        Dataset AI
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Katalog materi kurikulum berkualitas tinggi yang dipelajari AI.</p>
                </div>

                <div className="relative group min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Cari mata pelajaran atau topik..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-900 placeholder:text-slate-300 shadow-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-600" />
                    <p className="font-bold animate-pulse">Menyelaraskan basis data...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Tidak ada data ditemukan</h3>
                    <p className="text-slate-400 max-w-xs mx-auto mt-2">Dataset sedang dalam proses pengumpulan otomatis oleh sistem AI.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((item) => (
                        <div key={item.id} className="group bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-emerald-100 transition-all cursor-default relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <BookOpen className="w-20 h-20 -rotate-12 translate-x-4 -translate-y-4" />
                            </div>
                            
                            <div className="flex items-start justify-between mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg tracking-widest">
                                            Kelas {item.grade}
                                        </span>
                                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg tracking-widest">
                                            {item.subject}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors mt-2">{item.topic}</h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 mt-6 border-t border-slate-50 pt-4">
                                <div className="flex items-center gap-1.5">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    <span className="text-sm font-black text-slate-700">{item.quality_score}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Score</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Database className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-black text-slate-700">{item.usage_count}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Usage</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-emerald-900 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Sparkles className="w-48 h-48" />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-xl font-black mb-2">Automated Data Collection</h2>
                    <p className="text-emerald-100 leading-relaxed font-medium">
                        Sistem kami secara otomatis mengumpulkan modul ajar dengan skor kualitas di atas 80% untuk memperkaya basis pengetahuan AI. 
                        Ini memastikan setiap dokumen yang Anda buat menggunakan referensi standar terbaik di Indonesia.
                    </p>
                </div>
            </div>
        </div>
    );
}
