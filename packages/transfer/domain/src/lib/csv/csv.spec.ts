import { CsvParseError, encodeCsv, parseCsv } from './csv';

const limits = { maxRows: 100, maxColumns: 20 };

describe('encodeCsv', () => {
    it('quotes only the fields that need it', () => {
        expect(
            encodeCsv([['plain', 'has,comma', 'has"quote', 'has\nnewline']])
        ).toBe('plain,"has,comma","has""quote","has\nnewline"');
    });

    it('separates rows with CRLF, as the RFC specifies', () => {
        expect(encodeCsv([['a'], ['b']])).toBe('a\r\nb');
    });
});

describe('parseCsv', () => {
    it('round-trips every character class that needs quoting', () => {
        const rows = [
            ['slug', 'title'],
            ['a', 'Comma, quote " and\nnewline']
        ];
        expect(parseCsv(encodeCsv(rows), limits)).toEqual(rows);
    });

    it('reads CRLF, LF and bare CR line endings', () => {
        expect(parseCsv('a,b\r\nc,d', limits)).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ]);
        expect(parseCsv('a,b\nc,d', limits)).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ]);
        expect(parseCsv('a,b\rc,d', limits)).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ]);
    });

    it('strips the BOM Excel writes, so the first header is matchable', () => {
        expect(parseCsv('﻿slug,title\r\na,b', limits)).toEqual([
            ['slug', 'title'],
            ['a', 'b']
        ]);
    });

    it('keeps empty trailing fields', () => {
        expect(parseCsv('a,,c', limits)).toEqual([['a', '', 'c']]);
    });

    it('does not invent a row from a trailing newline', () => {
        expect(parseCsv('a,b\r\n', limits)).toEqual([['a', 'b']]);
    });

    it('rejects a file that ends inside a quoted field', () => {
        expect(() => parseCsv('a,"unterminated', limits)).toThrow(
            CsvParseError
        );
    });

    it('refuses a file over the row limit', () => {
        const many = Array.from({ length: 5 }, () => 'x').join('\n');
        expect(() => parseCsv(many, { maxRows: 3, maxColumns: 20 })).toThrow(
            /more than 3 rows/
        );
    });

    it('refuses a row over the column limit', () => {
        expect(() =>
            parseCsv('a,b,c,d', { maxRows: 10, maxColumns: 2 })
        ).toThrow(/more than 2 columns/);
    });
});
