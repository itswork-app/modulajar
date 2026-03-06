'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface PreviewPaneProps {
    workspaceId: string;
    moduleId: string;
    version: number;
}

export function PreviewPane({ workspaceId, moduleId, version }: PreviewPaneProps) {
    const { getToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [html, setHtml] = useState<string>('');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        async function fetchPreview() {
            setLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/w/${workspaceId}/modules/${moduleId}/preview?v=${version}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load preview');
                const content = await res.text();
                setHtml(content);
            } catch (err) {
                console.error(err);
                setHtml('<div style="padding: 2rem; color: #ef4444; font-family: sans-serif; font-weight: bold;">Gagal memuat preview.</div>');
            } finally {
                setLoading(false);
            }
        }
        fetchPreview();
    }, [workspaceId, moduleId, version, getToken]);

    return (
        <div className="flex-1 bg-slate-200 relative">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            )}
            <iframe
                ref={iframeRef}
                className="w-full h-full border-none bg-white shadow-inner"
                title="Module Preview"
                srcDoc={html}
            />
        </div>
    );
}
