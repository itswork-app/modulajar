import { EmptyState } from '@/components/ui/EmptyState';
import { Building } from 'lucide-react';

export default function WorkspacePage() {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Workspace</h1>
            <EmptyState
                icon={Building}
                title="Workspace (Segera Hadir)"
                description="Kelola profil sekolah dan kop surat untuk modul ajar Anda."
            />
        </div>
    );
}
