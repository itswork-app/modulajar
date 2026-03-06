'use client';

import { useState, useEffect } from 'react';
import { ModuleDetailResponse } from 'shared-types';
import { Loader2, Download, ExternalLink, FileText, CheckCircle2, PenTool } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ModuleDetailPage({ params }: { params: { workspaceId: string, moduleId: string } }) {
    const [module, setModule] = useState<ModuleDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        async function fetchModule() {
            try {
                const res = await fetch(`/api/w/${params.workspaceId}/modules/${params.moduleId}`);
                if (!res.ok) throw new Error('Failed to load module details');
                const data = await res.json();
                setModule(data);
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('An unknown error occurred');
                }
            } finally {
                setLoading(false);
            }
        }

        fetchModule();
    }, [params.workspaceId, params.moduleId]);

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
    if (error) return <div className="py-20 text-center text-red-500">{error}</div>;
    if (!module) return null;

    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <button onClick={() => router.push(`/w/${params.workspaceId}/modules/new`)} className="mb-8 text-emerald-600 hover:text-emerald-700 font-bold text-sm">
                &larr; Create another module
            </button>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <div className="flex items-start justify-between mb-8 pb-8 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                                {module.status}
                            </span>
                            <span className="text-slate-500 text-sm">Grade {module.grade} • {module.subject}</span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900">{module.topic}</h1>
                    </div>
                    <button
                        onClick={() => router.push(`/w/${params.workspaceId}/modules/${params.moduleId}/edit`)}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95"
                    >
                        <PenTool className="w-5 h-5" /> Edit Module
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Left Col: Actions */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5" /> Artifacts</h3>

                        {module.pdf ? (
                            <a
                                href={module.pdf.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Download className="w-5 h-5" /></div>
                                    <div>
                                        <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">Download PDF</div>
                                        <div className="text-xs text-slate-500 mt-0.5">SHA256: {module.pdf.sha256.substring(0, 8)}...</div>
                                    </div>
                                </div>
                            </a>
                        ) : (
                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> PDF is still generating...
                            </div>
                        )}

                        {module.verify && (
                            <a
                                href={module.verify.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                                    <div>
                                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">Public Verification</div>
                                        <div className="text-xs text-slate-500 mt-0.5">ID: {module.verify.public_id}</div>
                                    </div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                            </a>
                        )}
                    </div>

                    {/* Right Col: Metadata Info */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h3 className="font-bold text-slate-900 mb-4">Module Information</h3>
                        <ul className="space-y-3 text-sm">
                            <li className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500">Subject</span>
                                <span className="font-medium text-slate-900">{module.subject}</span>
                            </li>
                            <li className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500">Grade Level</span>
                                <span className="font-medium text-slate-900">{module.grade}</span>
                            </li>
                            <li className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500">Topic</span>
                                <span className="font-medium text-slate-900">{module.topic}</span>
                            </li>
                            <li className="flex justify-between pb-2">
                                <span className="text-slate-500">Module ID</span>
                                <span className="font-mono text-xs text-slate-400">{module.module_id}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
