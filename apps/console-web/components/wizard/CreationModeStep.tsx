'use client';

import { GenerationMode } from 'shared-types';
import { motion } from 'framer-motion';
import { Sparkles, FileEdit, Zap } from 'lucide-react';

interface CreationModeStepProps {
    onSelect: (mode: GenerationMode) => void;
}

export function CreationModeStep({ onSelect }: CreationModeStepProps) {
    const modes = [
        {
            id: 'template' as GenerationMode,
            title: 'Use Recommended Template',
            description: 'Start with a high-quality, pre-built template curated for your subject.',
            icon: <Sparkles className="w-8 h-8 text-emerald-500" />,
            badge: 'Recommended',
            bgClass: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
        },
        {
            id: 'edit_template' as GenerationMode,
            title: 'Edit a Template',
            description: 'Select a template and customize its structure before generation.',
            icon: <FileEdit className="w-8 h-8 text-blue-500" />,
            bgClass: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
        },
        {
            id: 'from_scratch' as GenerationMode,
            title: 'From Scratch with AI',
            description: 'Generate a completely new module using AI based on your topic and grade.',
            icon: <Zap className="w-8 h-8 text-amber-500" />,
            bgClass: 'bg-amber-50 hover:bg-amber-100 border-amber-200'
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">How would you like to build?</h1>
                <p className="text-slate-600">Choose a path to create your module.</p>
            </div>

            <div className="flex flex-col gap-4">
                {modes.map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => onSelect(mode.id)}
                        className={`text-left p-6 rounded-2xl border-2 transition-all duration-200 ${mode.bgClass} flex items-start gap-4 group/card`}
                    >
                        <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                            {mode.icon}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-bold text-slate-900">{mode.title}</h3>
                                {mode.badge && (
                                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                        {mode.badge}
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {mode.description}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    );
}
