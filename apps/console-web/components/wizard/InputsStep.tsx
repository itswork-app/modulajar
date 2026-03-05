'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { WizardInputs } from './types';

interface InputsStepProps {
    initialInputs?: WizardInputs;
    defaultGrade?: number;
    onSubmit: (inputs: WizardInputs) => void;
}

export function InputsStep({ initialInputs, defaultGrade = 4, onSubmit }: InputsStepProps) {
    const [subject, setSubject] = useState(initialInputs?.subject || 'Matematika');
    const [grade, setGrade] = useState(initialInputs?.grade || defaultGrade);
    const [topic, setTopic] = useState(initialInputs?.topic || '');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) {
            setError('Topic is required');
            return;
        }
        onSubmit({ subject, grade, topic, semester: '1' });
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl mx-auto"
        >
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Module Details</h2>
                <p className="text-slate-600">What are you teaching next?</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                    <div className="relative">
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl appearance-none font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                        >
                            <option value="Matematika">Matematika</option>
                            <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                            <option value="IPA">Ilmu Pengetahuan Alam</option>
                            <option value="IPS">Ilmu Pengetahuan Sosial</option>
                            <option value="PPKn">PPKn</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            ▼
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Grade</label>
                    <div className="grid grid-cols-6 gap-2">
                        {[1, 2, 3, 4, 5, 6].map(g => (
                            <button
                                key={g}
                                type="button"
                                onClick={() => setGrade(g)}
                                className={`py-3 rounded-xl font-bold text-center transition-all ${grade === g
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Specific Topic</label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => {
                            setTopic(e.target.value);
                            setError('');
                        }}
                        placeholder="e.g. Pecahan Sederhana, Tata Surya..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                    />
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>

                <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200/50"
                >
                    Continue <ArrowRight className="w-5 h-5" />
                </button>
            </form>
        </motion.div>
    );
}
