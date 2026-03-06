'use client';

import { Layout, MessageSquare, BookOpen, PenTool, CheckCircle, HelpCircle } from 'lucide-react';

interface SectionNavProps {
    activeSection: string;
    onSelect: (section: string) => void;
}

const sections = [
    { id: 'identitas', label: 'Identitas Modul', icon: Layout },
    { id: 'tujuan_pembelajaran', label: 'Tujuan Pembelajaran', icon: BookOpen },
    { id: 'materi_pembelajaran', label: 'Materi Pembelajaran', icon: PenTool },
    { id: 'kegiatan_pembelajaran', label: 'Kegiatan Pembelajaran', icon: MessageSquare },
    { id: 'penilaian', label: 'Penilaian / Asesmen', icon: CheckCircle },
    { id: 'lampiran', label: 'Lampiran', icon: HelpCircle },
];

export function SectionNav({ activeSection, onSelect }: SectionNavProps) {
    return (
        <nav className="p-2 space-y-1 overflow-y-auto flex-1">
            {sections.map((s) => (
                <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSection === s.id
                            ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                        }`}
                >
                    <s.icon className={`w-4 h-4 ${activeSection === s.id ? 'text-emerald-500' : 'text-slate-400'}`} />
                    {s.label}
                </button>
            ))}
        </nav>
    );
}
