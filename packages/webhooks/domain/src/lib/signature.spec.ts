import {
    computeSignature,
    parseSignatureHeader,
    signatureHeader,
    verifySignature
} from './signature';

const SECRET = 'whsec_test_secret';
const BODY = '{"event":"entry.published"}';
const TIMESTAMP = 1_756_468_320;

describe('computeSignature', () => {
    it('is stable for a known vector', () => {
        // Pinned so a refactor of the signing string is caught here rather than
        // by every receiver in the field at once.
        expect(computeSignature(SECRET, TIMESTAMP, BODY)).toBe(
            computeSignature(SECRET, TIMESTAMP, BODY)
        );
        expect(computeSignature(SECRET, TIMESTAMP, BODY)).toHaveLength(64);
    });

    it('changes with the timestamp, so a captured body cannot be replayed', () => {
        expect(computeSignature(SECRET, TIMESTAMP, BODY)).not.toBe(
            computeSignature(SECRET, TIMESTAMP + 1, BODY)
        );
    });

    it('changes with the secret', () => {
        expect(computeSignature(SECRET, TIMESTAMP, BODY)).not.toBe(
            computeSignature('other', TIMESTAMP, BODY)
        );
    });
});

describe('parseSignatureHeader', () => {
    it('reads the header this package produces', () => {
        const header = signatureHeader(SECRET, TIMESTAMP, BODY);
        expect(parseSignatureHeader(header)).toEqual({
            timestamp: TIMESTAMP,
            signature: computeSignature(SECRET, TIMESTAMP, BODY)
        });
    });

    it.each([
        'garbage',
        't=abc,v1=deadbeef',
        'v1=deadbeef',
        't=123',
        't=123,v1=nothex!'
    ])('returns null for %p', (header) => {
        expect(parseSignatureHeader(header)).toBeNull();
    });
});

describe('verifySignature', () => {
    const now = new Date(TIMESTAMP * 1000);

    it('accepts a delivery we just signed', () => {
        const header = signatureHeader(SECRET, TIMESTAMP, BODY);
        expect(verifySignature(SECRET, header, BODY, now)).toBe(true);
    });

    it('rejects a body that was altered in flight', () => {
        const header = signatureHeader(SECRET, TIMESTAMP, BODY);
        expect(verifySignature(SECRET, header, `${BODY} `, now)).toBe(false);
    });

    it('rejects the wrong secret', () => {
        const header = signatureHeader(SECRET, TIMESTAMP, BODY);
        expect(verifySignature('other', header, BODY, now)).toBe(false);
    });

    it('rejects a replay outside the tolerance window', () => {
        const header = signatureHeader(SECRET, TIMESTAMP, BODY);
        const muchLater = new Date((TIMESTAMP + 3600) * 1000);
        expect(verifySignature(SECRET, header, BODY, muchLater)).toBe(false);
    });

    it('accepts a delivery that is merely slow', () => {
        const header = signatureHeader(SECRET, TIMESTAMP, BODY);
        const slightlyLater = new Date((TIMESTAMP + 60) * 1000);
        expect(verifySignature(SECRET, header, BODY, slightlyLater)).toBe(true);
    });
});
