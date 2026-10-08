import { describe, expect, it } from 'vitest';
import type { ContentField, ContentTypeDetail } from '../types/contentType';
import { initialEntryValues, initialValueFor, mergeEntryValues } from '.';

const field = (
    name: string,
    type: string,
    extra: Partial<ContentField> = {}
): ContentField => ({
    name,
    type,
    required: false,
    validation: {},
    admin: {},
    ...extra
});

const schema = (...fields: ContentField[]): ContentTypeDetail => ({
    name: 'event',
    kind: 'collection',
    label: 'Events',
    fields
});

// 2026-03-05 09:07 local time.
const NOW = new Date(2026, 2, 5, 9, 7, 42);

describe('initialValueFor', () => {
    it('starts a field at its declared default', () => {
        expect(
            initialValueFor(
                field('title', 'text', { defaultValue: 'Untitled' }),
                NOW
            )
        ).toBe('Untitled');
        expect(
            initialValueFor(field('on', 'boolean', { defaultValue: true }), NOW)
        ).toBe(true);
        expect(
            initialValueFor(
                field('stage', 'select', {
                    options: ['a', 'b'],
                    defaultValue: 'b'
                }),
                NOW
            )
        ).toBe('b');
    });

    it('falls back to the empty value without a default', () => {
        expect(initialValueFor(field('title', 'text'), NOW)).toBe('');
        expect(initialValueFor(field('on', 'boolean'), NOW)).toBeNull();
        expect(initialValueFor(field('tags', 'multiselect'), NOW)).toEqual([]);
    });

    it('resolves the relative defaults in the form’s own local formats', () => {
        expect(
            initialValueFor(
                field('day', 'date', { defaultValue: 'today' }),
                NOW
            )
        ).toBe('2026-03-05');
        expect(
            initialValueFor(
                field('at', 'datetime', { defaultValue: 'now' }),
                NOW
            )
        ).toBe('2026-03-05T09:07');
    });

    it('hands out a copy of an array default, never the schema’s own', () => {
        const defaultValue = ['a'];
        const seeded = initialValueFor(
            field('tags', 'multiselect', { options: ['a'], defaultValue }),
            NOW
        ) as string[];
        expect(seeded).toEqual(['a']);
        seeded.push('b');
        expect(defaultValue).toEqual(['a']);
    });
});

describe('initialEntryValues vs mergeEntryValues', () => {
    const type = schema(
        field('title', 'text'),
        field('stage', 'select', { options: ['a', 'b'], defaultValue: 'a' })
    );

    it('a new entry starts at the defaults', () => {
        expect(initialEntryValues(type, NOW)).toEqual({
            title: '',
            stage: 'a'
        });
    });

    it('a stored entry without the field stays empty — a default is a prefill, not a stored value', () => {
        expect(mergeEntryValues(type, { title: 'Hello' })).toEqual({
            title: 'Hello',
            stage: ''
        });
    });
});
