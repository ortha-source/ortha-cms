import { InvalidFileNameError } from '../errors/invalid-file-name.error';
import { FileName } from './file-name';

describe('FileName [media:I-22]', () => {
    it('trims and keeps a plain leaf name', () => {
        expect(FileName.create('  logo.png  ').value).toBe('logo.png');
    });

    it('accepts a name of exactly the length limit', () => {
        const name = `${'z'.repeat(251)}.png`;
        expect(name).toHaveLength(255);
        expect(FileName.create(name).value).toBe(name);
    });

    it.each([
        ['empty', ''],
        ['whitespace only', '   '],
        ['over the length limit', `${'z'.repeat(252)}.png`],
        ['a forward slash', '../../etc/passwd'],
        ['a backslash', 'a\\b.png']
    ])('rejects %s', (_label, raw) => {
        expect(() => FileName.create(raw)).toThrow(InvalidFileNameError);
    });

    it.each([
        ['NUL', `a${String.fromCharCode(0)}.png`],
        ['a newline', 'a\nb.png'],
        ['a carriage return', 'a\rb.png'],
        ['DEL', `a${String.fromCharCode(127)}.png`]
    ])('rejects %s', (_label, raw) => {
        // A NUL is not representable in a Postgres `text` column at all, so a
        // rename carrying one came back as a driver-level 500 rather than the
        // 400 it plainly is. The rest are rejected on the same principle: the
        // name is stored, echoed in `Content-Disposition`, and used to build a
        // storage key.
        expect(() => FileName.create(raw)).toThrow(InvalidFileNameError);
    });
});
