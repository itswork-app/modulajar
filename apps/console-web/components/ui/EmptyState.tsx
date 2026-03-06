import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    actionIcon?: LucideIcon;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    actionHref,
    actionIcon: ActionIcon
}: EmptyStateProps) {
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center mt-8">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border-8 border-emerald-50/50">
                <Icon className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg">
                {description}
            </p>
            {actionLabel && actionHref && (
                <Link
                    href={actionHref}
                    className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-1 transition-all font-bold text-lg shadow-lg shadow-emerald-600/30 group"
                >
                    {ActionIcon && <ActionIcon className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />}
                    {actionLabel}
                </Link>
            )}
        </div>
    );
}
