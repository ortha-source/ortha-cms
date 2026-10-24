import { describe, expect, it } from 'vitest';
import {
    DEFAULT_EXPIRY_PRESET,
    EXPIRING_SOON_DAYS,
    daysUntil,
    expiresWithinWindow,
    expiryFromPreset
} from './index';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const DAY = 86_400_000;

describe('expiryFromPreset', () => {
    it('resolves a day preset to that many days from now', () => {
        expect(expiryFromPreset('90', NOW)?.getTime()).toBe(NOW + 90 * DAY);
    });

    it('resolves Never to no expiry at all', () => {
        expect(expiryFromPreset('never', NOW)).toBeNull();
    });

    it('defaults to a finite preset, so a forgotten token dies', () => {
        expect(DEFAULT_EXPIRY_PRESET).not.toBe('never');
    });
});

describe('expiresWithinWindow', () => {
    it('is true inside the window and at its edge', () => {
        expect(expiresWithinWindow(new Date(NOW + DAY), NOW)).toBe(true);
        expect(
            expiresWithinWindow(new Date(NOW + EXPIRING_SOON_DAYS * DAY), NOW)
        ).toBe(true);
    });

    it('is false past the window, for no expiry, and once already expired', () => {
        expect(
            expiresWithinWindow(
                new Date(NOW + (EXPIRING_SOON_DAYS + 1) * DAY),
                NOW
            )
        ).toBe(false);
        expect(expiresWithinWindow(null, NOW)).toBe(false);
        expect(expiresWithinWindow(new Date(NOW - DAY), NOW)).toBe(false);
    });
});

describe('daysUntil', () => {
    it('rounds up, so a token never reads as expiring sooner than it does', () => {
        expect(daysUntil(new Date(NOW + 11.2 * DAY), NOW)).toBe(12);
    });

    it('never goes below zero', () => {
        expect(daysUntil(new Date(NOW - DAY), NOW)).toBe(0);
    });
});
