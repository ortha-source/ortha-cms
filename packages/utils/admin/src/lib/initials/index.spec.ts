import { describe, expect, it } from 'vitest';
import { initialsFromEmail, initialsOf } from '.';

describe('initialsOf', () => {
    it.each([
        ['Ada Lovelace', 'AL'],
        ['  Ada   Lovelace ', 'AL'],
        ['Ada', 'A'],
        ['Ada Byron Lovelace', 'AB'],
        ['ada lovelace', 'AL'],
        ['', ''],
        ['   ', '']
    ])('maps %j to %j', (name, expected) => {
        expect(initialsOf(name)).toBe(expected);
    });

    // BUG-utils-admin-06 / A11Y-utils-admin-03 — `part[0]` would slice a UTF-16
    // code unit and hand the avatar a lone surrogate (a tofu box, and nothing
    // useful to a screen reader). The leading character must stay whole.
    it.each([
        ['😀 Smith', '😀S'],
        ['𝒜da Lovelace', '𝒜L'],
        ['👩‍💻 Ops', '👩O']
    ])('keeps the leading code point of %j whole, giving %j', (name, expected) => {
        const initials = initialsOf(name);
        expect(initials).toBe(expected);
        // A lone surrogate — an unpaired half of an astral character — renders
        // as a tofu box and announces as nothing.
        expect(initials).not.toMatch(
            /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
        );
    });

    it('takes the first two parts only', () => {
        expect(initialsOf('a b c d e')).toBe('AB');
    });
});

describe('initialsFromEmail', () => {
    it.each([
        ['ada.lovelace@example.com', 'AL'],
        ['ada@example.com', 'A'],
        ['ada-lovelace@example.com', 'AL'],
        ['ada_lovelace@example.com', 'AL'],
        ['ada+tag@example.com', 'AT'],
        ['@example.com', ''],
        ['', '']
    ])('maps %j to %j', (email, expected) => {
        expect(initialsFromEmail(email)).toBe(expected);
    });

    it('uses the whole string when there is no @', () => {
        expect(initialsFromEmail('ada.lovelace')).toBe('AL');
    });

    it('reads the local part, never the domain', () => {
        expect(initialsFromEmail('ada@zeta.example')).toBe('A');
    });
});
