import { EmptyState } from '@/components/ui/EmptyState';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Pengaturan</h1>
            <EmptyState
                icon={Settings}
                title="Pengaturan (Segera Hadir)"
                description="Atur profil pengguna, preferensi kelas dan mata pelajaran."
            />
        </div>
    );
}
