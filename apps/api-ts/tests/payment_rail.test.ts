import t from 'tap';
import { voucherService } from '../src/lib/voucher';
import { xendit } from '../src/lib/xendit';

t.test('Payment Rail Verification', async (st) => {
    st.test('Voucher Code Generation', async (sst) => {
        const code1 = voucherService.generateCode();
        const code2 = voucherService.generateCode();
        sst.ok(code1.startsWith('VA-'), 'Code 1 starts with VA-');
        sst.ok(code1 !== code2, 'Codes are unique');
        // Part 1: VA-XXXX-XXXX (VA- is 3, hex parts are 4 each, hyphen is 1) = 3+4+1+4 = 12?
        // Wait, VA-XXXX-XXXX is VA (2) + - (1) + XXXX (4) + - (1) + XXXX (4) = 12 chars.
        // My implementation: `VA-${parts.join('-')}` where parts is 2 hex strings of 2 bytes (4 chars).
        // Result: VA-XXXX-XXXX. Correct.
        sst.match(code1, /^VA-[0-9A-F]{4}-[0-9A-F]{4}$/, 'Format is VA-XXXX-XXXX');
    });

    st.test('Xendit Webhook Verification Logic', async (sst) => {
        const originalToken = process.env.XENDIT_CALLBACK_TOKEN;
        process.env.XENDIT_CALLBACK_TOKEN = 'test_token';
        sst.ok(xendit.verifyCallback('test_token'), 'Correct token matches');
        sst.notOk(xendit.verifyCallback('wrong_token'), 'Incorrect token fails');
        sst.notOk(xendit.verifyCallback(undefined), 'Empty token fails');
        process.env.XENDIT_CALLBACK_TOKEN = originalToken;
    });
});
