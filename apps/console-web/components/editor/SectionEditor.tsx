'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SectionEditorProps {
    section: string;
    content: string | Record<string, unknown>;
    onUpdate: (content: string | Record<string, unknown>) => void;
    onAI: (content: string) => void;
}

export function SectionEditor({ section, content, onUpdate, onAI }: SectionEditorProps) {
    const [localContent, setLocalContent] = useState(() => {
        if (typeof content === 'string') return content;
        if (content && typeof content === 'object') return JSON.stringify(content, null, 2);
        return '';
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalContent(val);

        // Pass up for autosave
        try {
            if (content && typeof content === 'object') {
                onUpdate(JSON.parse(val));
            } else {
                onUpdate(val);
            }
        } catch {
            onUpdate(val);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 capitalize">
                    {section.replace(/_/g, ' ')}
                </h2>
                <button
                    onClick={() => onAI(localContent)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                    <Sparkles className="w-4 h-4" /> Perbaiki dengan AI
                </button>
            </div>

            <textarea
                value={localContent}
                onChange={handleChange}
                className="w-full h-[500px] p-6 rounded-2xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 ring-inset outline-none transition-all text-slate-800 font-medium leading-relaxed resize-none bg-slate-50/30"
                placeholder={`Edit ${section.replace(/_/g, ' ')} di sini...`}
            />
        </div>
    );
}
