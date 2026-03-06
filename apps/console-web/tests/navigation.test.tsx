import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../components/ui/sidebar';

vi.mock('next/navigation', () => ({
    usePathname: () => '/'
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ getToken: vi.fn(() => Promise.resolve('mock-token')), isLoaded: true }),
    useUser: () => ({ user: { fullName: 'Test Teacher' } }),
    UserButton: () => <div data-testid="user-button">User</div>
}));

describe('Sidebar Navigation', () => {
    it('renders all required sidebar links', () => {
        render(<Sidebar />);

        expect(screen.getByText('Dashboard')).toBeDefined();
        expect(screen.getByText('Buat Modul')).toBeDefined();
        expect(screen.getByText('Riwayat Modul')).toBeDefined();
        expect(screen.getByText('Template')).toBeDefined();
        expect(screen.getByText('Dataset AI')).toBeDefined();
        expect(screen.getByText('Billing')).toBeDefined();
        expect(screen.getByText('Referral')).toBeDefined();
        expect(screen.getByText('Workspace')).toBeDefined();
        expect(screen.getByText('Pengaturan')).toBeDefined();
    });
});
