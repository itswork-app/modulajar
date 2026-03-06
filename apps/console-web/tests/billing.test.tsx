import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BillingPage from '../app/(dashboard)/billing/page';

// Mock Dependencies
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace })
}));

vi.mock('@clerk/nextjs', () => ({
    useAuth: () => ({ getToken: vi.fn(() => Promise.resolve('mock-token')), isLoaded: true }),
    useUser: () => ({ user: { fullName: 'Test Teacher' } })
}));

vi.mock('@/hooks/use-workspace', () => ({
    useWorkspace: () => ({ workspace: { id: 'test-workspace-id' }, isLoading: false })
}));

describe('Billing UX v1 - Integration Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    const mockUsageSummarySuccess = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/wallet/summary')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve({
                    credits_remaining: 125,
                    documents_generated: 42,
                    month_usage: 12
                })
            });
            if (url.includes('/wallet/transactions')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve([
                    { date: '2026-03-01', type: 'topup', amount: 50, status: 'success', note: 'Promo' },
                    { date: '2026-03-05', type: 'generate_module', amount: -1, status: 'success', note: 'Matematika' }
                ])
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });
    };

    it('billing page renders summary cards with correct token balance', async () => {
        mockUsageSummarySuccess();
        render(<BillingPage />);

        await waitFor(() => {
            expect(screen.getByText('125')).toBeDefined(); // Token balance
            expect(screen.getByText('42')).toBeDefined(); // Documents generated
            expect(screen.getByText('Saldo Kredit Saat Ini')).toBeDefined();
        });
    });

    it('billing page renders transaction history table correctly', async () => {
        mockUsageSummarySuccess();
        render(<BillingPage />);

        await waitFor(() => {
            // Check headers
            expect(screen.getByText('Tanggal')).toBeDefined();
            // Check mapped type and amounts
            expect(screen.getByText('TOPUP')).toBeDefined();
            expect(screen.getByText('GENERATE MODULE')).toBeDefined();
            expect(screen.getByText('+50 Token')).toBeDefined();
            expect(screen.getByText('-1 Token')).toBeDefined();
            expect(screen.getByText('Matematika')).toBeDefined();
        });
    });

    it('billing page renders empty transaction history cleanly', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/wallet/summary')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve({ credits_remaining: 0, documents_generated: 0, month_usage: 0 })
            });
            if (url.includes('/wallet/transactions')) return Promise.resolve({
                status: 200, ok: true, json: () => Promise.resolve([])
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<BillingPage />);

        await waitFor(() => {
            expect(screen.getByText('Belum ada transaksi')).toBeDefined();
            expect(screen.getByText('Riwayat pembelian paket, penukaran voucher, dan penggunaan kredit akan muncul di sini.')).toBeDefined();
        });
    });

    it('top up modal opens and interacts correctly', async () => {
        mockUsageSummarySuccess();
        render(<BillingPage />);

        // Wait for page load
        await waitFor(() => {
            expect(screen.getByText('Top Up Kredit')).toBeDefined();
        });

        // Open Modal
        fireEvent.click(screen.getByText('Top Up Kredit'));

        // Check modal content
        expect(screen.getByText('Pilih paket yang sesuai kebutuhan Anda')).toBeDefined();
        expect(screen.getByText('Lanjutkan Pembayaran').hasAttribute('disabled')).toBe(true); // Disabled until package selected

        // Select a package (the second '50 Token' belongs to the Modal in DOM order)
        const tokenElements = screen.getAllByText('50 Token');
        fireEvent.click(tokenElements[1]);
        expect(screen.getByText('Lanjutkan Pembayaran').hasAttribute('disabled')).toBe(false);
    });

    it('voucher modal opens and interacts correctly', async () => {
        mockUsageSummarySuccess();
        render(<BillingPage />);

        // Wait for page load
        await waitFor(() => {
            expect(screen.getByText('Redeem Voucher')).toBeDefined();
        });

        // Open Modal
        fireEvent.click(screen.getByText('Redeem Voucher'));

        // Check modal content & disabled button state
        expect(screen.getByText('Masukkan Kode Voucher')).toBeDefined();
        const klaimButton = screen.getByText('Klaim Kredit');
        expect(klaimButton.hasAttribute('disabled')).toBe(true);

        // Type in input enabling the button
        const input = screen.getByPlaceholderText('M-AJAR-ABC');
        fireEvent.change(input, { target: { value: 'TESTVOUCHER' } });

        expect(klaimButton.hasAttribute('disabled')).toBe(false);
    });

    it('billing page renders loading state initially', async () => {
        mockUsageSummarySuccess();
        render(<BillingPage />);
        expect(screen.getByText('Memuat data billing...')).toBeDefined();
    });

    it('billing page renders error state if API fails', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/wallet/summary') || url.includes('/wallet/transactions')) return Promise.resolve({
                status: 500, ok: false, text: () => Promise.resolve('Error')
            });
            return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
        });

        render(<BillingPage />);

        await waitFor(() => {
            expect(screen.getByText('Gagal memuat data billing.')).toBeDefined();
        });
    });
});
