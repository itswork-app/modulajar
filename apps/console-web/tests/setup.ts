import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
    // Clear any pending timers to avoid React 19 scheduler 'window is not defined' errors
    // when tests unmount but components still try to update state asynchronously
    vi.clearAllTimers();
});
