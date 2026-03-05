'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BookOpen, ArrowRight } from 'lucide-react';

const SUBJECTS = [
    'Matematika',
    'Bahasa Indonesia',
    'IPA',
    'IPS',
    'PPKn',
    'SBdP',
    'PJOK',
];

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AssignmentPage() {
    const router = useRouter();
    const [subject, setSubject] = useState('');
    const [grade, setGrade] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject) {
            setError('Pilih mata pelajaran');
            return;
        }
        if (!grade) {
            setError('Pilih kelas');
            return;
        }
        setError('');
        setLoading(true);

        try {
            router.push('/onboarding/start');
        } catch {
            setError('Gagal menyimpan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="mb-8">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
                    <BookOpen className="w-7 h-7 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Kelas & Mata Pelajaran</h1>
                <p className="text-slate-500">Apa yang Anda ajarkan?</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                        Mata Pelajaran <span className="text-red-400">*</span>
                    </label>
                    <select
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-base appearance-none"
                    >
                        <option value="">Pilih mata pelajaran...</option>
                        {SUBJECTS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="grade" className="block text-sm font-medium text-slate-700 mb-2">
                        Kelas <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                        {GRADES.map(g => (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setGrade(g)}
                                className={`py-3 rounded-xl font-semibold text-sm transition-all ${grade === g
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading || !subject || !grade}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200/50 group"
                >
                    {loading ? 'Menyimpan...' : 'Lanjutkan'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </form>
        </motion.div>
    );
}
