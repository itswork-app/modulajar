import { EmptyState } from '@/components/ui/EmptyState';
import { Database } from 'lucide-react';

export default function DatasetPage() {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Dataset AI</h1>
            <EmptyState
                icon={Database}
                title="Dataset AI (Segera Hadir)"
                description="Halaman ini akan menampilkan contoh modul untuk meningkatkan kualitas AI."
            />
        </div>
    );
}
