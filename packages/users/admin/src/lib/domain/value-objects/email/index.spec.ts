import { describe, expect, it } from 'vitest';
import { Email } from './index';

/**
 * The single client-side email rule: the invite field's per-keystroke feedback
 * and the invite use-case's last guard both read it, so what it accepts decides
 * what the form lets through. The server stays the authority — these pin the
 * shape gate, not the address's existence.
 */

/** An address of exactly `length` characters, still well-shaped. */
function emailOfLength(length: number): string {
    const domain = '@example.com';
    return 'a'.repeat(length - domain.length) + domain;
}

describe('Email.isValid', () => {
    it('accepts an ordinary address', () => {
        expect(Email.isValid('grace@example.com')).toBe(true);
    });

    it.each([
        ['', 'empty — the untouched field'],
        ['a@b', 'no dot in the domain'],
        ['a b@c.co', 'a space in the local part'],
        ['@b.co', 'no local part'],
        ['a@', 'no domain']
    ])('rejects %j (%s)', (value) => {
        expect(Email.isValid(value)).toBe(false);
    });

    it('accepts the longest address the server stores', () => {
        // Both sides of the bound, because an off-by-one here is invisible in
        // the UI: too tight silently blocks a legal address at the field, too
        // loose lets the request through to a column overflow on the server.
        expect(emailOfLength(320)).toHaveLength(320);
        expect(Email.isValid(emailOfLength(320))).toBe(true);
    });

    it('rejects one character past the bound', () => {
        expect(Email.isValid(emailOfLength(321))).toBe(false);
    });
});

describe('Email.create', () => {
    it('round-trips the address it was built from', () => {
        expect(Email.create('grace@example.com').value).toBe(
            'grace@example.com'
        );
    });

    it('throws naming the offending value', () => {
        // The message quotes the input, which is what makes a thrown guard
        // legible in a log; pinned so it cannot degrade to a bare "invalid".
        expect(() => Email.create('a@b')).toThrow(
            'Invalid member email: "a@b"'
        );
    });

    it('throws on an empty value rather than building a blank address', () => {
        expect(() => Email.create('')).toThrow('Invalid member email: ""');
    });
});

describe('Email.splitList', () => {
    it('splits on commas, semicolons, spaces and newlines', () => {
        expect(
            Email.splitList(
                'lena@growth.io, sam@growth.io;kai@growth.io\nmo@x.io'
            )
        ).toEqual([
            'lena@growth.io',
            'sam@growth.io',
            'kai@growth.io',
            'mo@x.io'
        ]);
    });

    it('keeps only the address of a `Name <address>` pair', () => {
        expect(
            Email.splitList('Ada Lovelace <Ada@Orthacms.dev>, Sam <sam@x.io>')
        ).toEqual(['ada@orthacms.dev', 'sam@x.io']);
    });

    it('lower-cases and drops repeats, keeping first-seen order', () => {
        expect(Email.splitList('B@x.io a@x.io b@X.IO')).toEqual([
            'b@x.io',
            'a@x.io'
        ]);
    });

    it('keeps a malformed piece so the person can see it', () => {
        expect(Email.splitList('not-an-email, ok@x.io')).toEqual([
            'not-an-email',
            'ok@x.io'
        ]);
    });

    it('answers nothing for blank input', () => {
        expect(Email.splitList(' , ;\n')).toEqual([]);
    });
});
