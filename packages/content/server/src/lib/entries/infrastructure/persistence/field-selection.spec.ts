import { BadRequestException } from '@nestjs/common';
import { collection } from '../../../collection/define';
import { field } from '../../../fields';
import type { AnyContentType } from '../../../types/content-type';
import { parseFieldSelection } from './field-selection';
import { toRecord } from './entry-row';

/**
 * `?fields=` is the external API's sparse-fieldset param. These pin the two
 * halves of its contract: what counts as a selectable name (and that an unknown
 * one fails loudly rather than silently emptying the record), and that the
 * projection narrows `values` while leaving the envelope intact.
 */
const author: AnyContentType = collection('author', {
    fields: { name: field.text() }
});

const article = collection('article', {
    publishable: true,
    fields: {
        title: field.text(),
        body: field.richtext(),
        author: field.relation({ to: () => author }),
        tags: field.relation({ to: () => author, many: true }),
        written: field.relationInverse({ of: () => author, field: 'name' })
    }
}) as AnyContentType;

describe('parseFieldSelection', () => {
    it('is undefined when the param is absent — the whole record', () => {
        expect(parseFieldSelection(article, undefined)).toBeUndefined();
    });

    it('treats an empty or blank param as no selection, not zero fields', () => {
        // Returning an empty set here would strip every value, so `?fields=`
        // with nothing after it must read as "unset".
        expect(parseFieldSelection(article, '')).toBeUndefined();
        expect(parseFieldSelection(article, '  ,  ,')).toBeUndefined();
    });

    it('collects the named fields, trimming whitespace', () => {
        expect(parseFieldSelection(article, ' title , body ')).toEqual(
            new Set(['title', 'body'])
        );
    });

    it('accepts an owning single relation (it owns an FK column)', () => {
        expect(parseFieldSelection(article, 'author')).toEqual(
            new Set(['author'])
        );
    });

    it('rejects an unknown name with a 400 rather than dropping it', () => {
        expect(() => parseFieldSelection(article, 'titel')).toThrow(
            BadRequestException
        );
    });

    it('names the offending fields in the message', () => {
        expect(() =>
            parseFieldSelection(article, 'title,nope,alsoNope')
        ).toThrow(/nope, alsoNope/);
    });

    it('rejects a many-relation and an inverse — neither has a row value', () => {
        expect(() => parseFieldSelection(article, 'tags')).toThrow(
            BadRequestException
        );
        expect(() => parseFieldSelection(article, 'written')).toThrow(
            BadRequestException
        );
    });

    it('rejects envelope columns — they are always returned, not selectable', () => {
        expect(() => parseFieldSelection(article, 'id')).toThrow(
            BadRequestException
        );
        expect(() => parseFieldSelection(article, 'status')).toThrow(
            BadRequestException
        );
    });
});

describe('toRecord with a field selection', () => {
    const row = {
        id: 'e1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        status: 'published',
        publishedAt: new Date('2026-01-03T00:00:00Z'),
        title: 'Hello',
        body: '<p>long</p>',
        author: 'a1'
    };

    it('returns every column-owning field when unselected', () => {
        const record = toRecord(article, row);
        expect(Object.keys(record.values).sort()).toEqual([
            'author',
            'body',
            'title'
        ]);
    });

    it('narrows `values` to the selection', () => {
        const record = toRecord(article, row, new Set(['title']));
        expect(record.values).toEqual({ title: 'Hello' });
    });

    it('keeps the envelope regardless of the selection', () => {
        const record = toRecord(article, row, new Set(['title']));
        expect(record.id).toBe('e1');
        expect(record.status).toBe('published');
        expect(record.createdAt).toBe('2026-01-01T00:00:00.000Z');
        expect(record.publishedAt).toBe('2026-01-03T00:00:00.000Z');
    });

    it('still omits many/inverse relations even when selected', () => {
        // Defence in depth: `parseFieldSelection` already rejects these, so this
        // pins that the mapper never emits them by another route.
        const record = toRecord(article, row, new Set(['title', 'tags']));
        expect(record.values).toEqual({ title: 'Hello' });
    });
});
