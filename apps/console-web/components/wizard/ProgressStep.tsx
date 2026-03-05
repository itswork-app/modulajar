'use client';

import { useState, useEffect, useRef } from 'react';
import { JobStatusResponse } from 'shared-types';
import { motion } from 'framer-motion';
import { Loader2, Zap, LayoutTemplate, FileCheck, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProgressStepProps {
    jobId: string;
    workspaceId: string;
    onDone: (moduleId: string) => void;
    onError: (error: string) => void;
}

export function ProgressStep({ jobId, workspaceId, onDone, onError }: ProgressStepProps) {
    const [status, setStatus] = useState<JobStatusResponse | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    useEffect(() => {
        let attempts = 0;
        let isActive = true;
        let currentDelay = 1000;

        const poll = async () => {
            if (!isActive) return;
            try {
                const res = await fetch(`/api/w/${workspaceId}/jobs/${jobId}`);
                if (!res.ok) throw new Error('Failed to fetch job status');

                const data: JobStatusResponse = await res.json();
                setStatus(data);

                if (data.status === 'done') {
                    onDone(data.module_id);
                    return; // Stop polling
                }

                if (data.status === 'failed') {
                    onError(data.error || 'Generation failed');
                    return; // Stop polling
                }

            } catch (err: any) {
                console.error("Polling error:", err);
            }

            // Exponential backoff capped at 8s
            attempts++;
            currentDelay = Math.min(currentDelay * 2, 8000);
            pollingRef.current = setTimeout(() => poll(), currentDelay);
        };

        // Start polling immediately
        poll();

        // Safety timeout 3 minutes
        timeoutRef.current = setTimeout(() => {
            isActive = false;
            if (pollingRef.current) clearTimeout(pollingRef.current);
            onError('Tunggu sebentar, modul Anda masih diproses. Silakan cek menu Modul dalam beberapa menit.');
        }, 180000);

        return () => {
            isActive = false;
            if (pollingRef.current) clearTimeout(pollingRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [jobId, workspaceId, onDone, onError]);

    const getPhaseContent = () => {
        const phase = status?.progress?.phase || 'queued';
        const pct = status?.progress?.pct || 0;

        switch (phase) {
            case 'queued':
                return { icon: <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />, title: 'Menyiapkan Data...', desc: 'Job Anda berada dalam antrean.' };
            case 'ai':
            case 'generating':
                return { icon: <Zap className="w-12 h-12 text-amber-500 animate-pulse" />, title: 'AI Sedang Bekerja', desc: 'Menyusun materi, tujuan, dan asesmen secara otomatis.' };
            case 'pdf':
            case 'render':
                return { icon: <LayoutTemplate className="w-12 h-12 text-emerald-500 animate-pulse" />, title: 'Menyusun Desain PDF', desc: 'Menyematkan kurikulum ke dalam format dokumen Modul Ajar.' };
            case 'done':
                return { icon: <FileCheck className="w-12 h-12 text-emerald-600" />, title: 'Modul Selesai!', desc: 'Mengarahkan Anda ke pratinjau...' };
            default:
                return { icon: <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />, title: 'Memproses...', desc: 'Mohon tunggu.' };
        }
    };

    const content = getPhaseContent();
    const pct = status?.progress?.pct || 5;

    return (
        <div className="w-full max-w-md mx-auto py-12 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={content.title}
                className="mb-8 flex justify-center"
            >
                <div className="p-6 bg-white rounded-full shadow-xl ring-1 ring-slate-100 flex items-center justify-center">
                    {content.icon}
                </div>
            </motion.div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">{content.title}</h2>
            <p className="text-slate-500 mb-10">{content.desc}</p>

            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ ease: "easeInOut", duration: 0.5 }}
                    className="bg-emerald-500 h-full rounded-full"
                />
            </div>

            <p className="text-xs text-slate-400 font-medium mt-4">Jangan tutup layar ini. Maksimal 1-2 menit.</p>
        </div>
    );
}
