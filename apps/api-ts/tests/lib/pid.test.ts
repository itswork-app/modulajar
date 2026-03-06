import tap from 'tap';
import { issuePID, workspaceShortCode, PID_REGEX } from '../../src/lib/pid';

const test = tap.test;

test('PID Utility — workspaceShortCode', async (t) => {
    const code1 = workspaceShortCode('ws_123');
    const code2 = workspaceShortCode('ws_124');
    t.equal(code1.length, 6);
    t.not(code1, code2, 'different workspaces should have different codes');
    t.equal(code1, workspaceShortCode('ws_123'), 'should be deterministic');
});

test('PID Utility — issuePID formatting branches', async (t) => {
    const params = {
        workspaceId: 'ws_test',
        packageUlid: 'ulid_test',
        kelas: '4',
        semester: '1',
        tahunAjaran: '2025/2026'
    };

    // Test default formatting
    const pid1 = issuePID('secret', params);
    t.ok(pid1.startsWith('PKG-SD4-S1-2026-'), 'should format class and semester with prefixes');
    t.ok(PID_REGEX.test(pid1), 'should match PID_REGEX');

    // Test with existing prefixes
    const pid2 = issuePID('secret', {
        ...params,
        kelas: 'SD5',
        semester: 'S2',
        tahunAjaran: '2027'
    });
    t.ok(pid2.startsWith('PKG-SD5-S2-2027-'), 'should not double-prefix');

    // Test with mixed casing
    const pid3 = issuePID('secret', {
        ...params,
        kelas: 'sd6',
        semester: 's1'
    });
    t.ok(pid3.startsWith('PKG-SD6-S1-2026-'), 'should normalize casing');
});
