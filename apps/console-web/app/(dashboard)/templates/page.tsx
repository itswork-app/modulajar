import { EmptyState } from '@/components/ui/EmptyState';
import { LayoutTemplate } from 'lucide-react';

export default function TemplatesPage() {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Template Library</h1>
            <EmptyState
                icon={LayoutTemplate}
                title="Template (Segera Hadir)"
                description="Koleksi template modul ajar terbaik dari komunitas Edukasi AI."
            />
        </div>
    );
}
