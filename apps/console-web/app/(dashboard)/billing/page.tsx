import { EmptyState } from '@/components/ui/EmptyState';
import { CreditCard } from 'lucide-react';

export default function BillingPage() {
    return (
        <div className="max-w-6xl mx-auto py-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-8">Billing</h1>
            <EmptyState
                icon={CreditCard}
                title="Billing (Segera Hadir)"
                description="Kelola saldo kredit dan akun Anda di sini."
            />
        </div>
    );
}
