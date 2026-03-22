import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeAll(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
});

afterEach(() => {
    cleanup();
    // Clear any pending timers to avoid React 19 scheduler 'window is not defined' errors
    // when tests unmount but components still try to update state asynchronously
    vi.clearAllTimers();
    vi.clearAllMocks();
});
