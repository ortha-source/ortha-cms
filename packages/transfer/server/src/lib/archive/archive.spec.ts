import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { deflateRawSync } from 'node:zlib';
import { DEFAULT_TRANSFER_LIMITS } from '@orthacms/transfer-domain';
import { createZipStream, type ZipMember } from './zip-writer';
import {
    ZipReadError,
    looksLikeZip,
    readZipDirectory,
    readZipEntry
} from './zip-reader';

const limits = DEFAULT_TRANSFER_LIMITS;

async function build(members: ZipMember[]): Promise<Buffer> {
    async function* iterate(): AsyncGenerator<ZipMember> {
        for (const member of members) yield member;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of createZipStream(iterate())) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/** Reads every member back into a `{ path: text }` map. */
function readAll(zip: Buffer): Record<string, string> {
    const out: Record<string, string> = {};
    for (const entry of readZipDirectory(zip, limits)) {
        out[entry.path] = readZipEntry(zip, entry, limits).toString('utf8');
    }
    return out;
}

describe('zip round trip', () => {
    it('reads back what it wrote, buffers and streams alike', async () => {
        const big = 'x'.repeat(200_000);
        const zip = await build([
            { path: 'manifest.json', body: Buffer.from('{"version":1}') },
            {
                path: 'entries/post.ndjson',
                body: Buffer.from('{"a":1}\n{"a":2}\n')
            },
            {
                path: 'assets/abc/photo.bin',
                body: Readable.from([
                    Buffer.from(big.slice(0, 100_000)),
                    Buffer.from(big.slice(100_000))
                ])
            }
        ]);

        expect(looksLikeZip(zip)).toBe(true);
        expect(readAll(zip)).toEqual({
            'manifest.json': '{"version":1}',
            'entries/post.ndjson': '{"a":1}\n{"a":2}\n',
            'assets/abc/photo.bin': big
        });
    });

    it('keeps a non-ASCII member name intact', async () => {
        const zip = await build([
            { path: 'assets/abc/фото файл.txt', body: Buffer.from('ok') }
        ]);

        expect(Object.keys(readAll(zip))).toEqual(['assets/abc/фото файл.txt']);
    });

    it('handles an empty member', async () => {
        const zip = await build([{ path: 'empty.txt', body: Buffer.alloc(0) }]);
        expect(readAll(zip)).toEqual({ 'empty.txt': '' });
    });
});

describe('archives written by other tools', () => {
    // The reader has to read what a person zipped on their own machine, not
    // only what this writer produced — the round-trip test above cannot catch a
    // shared misreading of the spec.
    const zipAvailable = (() => {
        try {
            execFileSync('zip', ['-v'], { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    })();

    (zipAvailable ? it : it.skip)('reads a CLI-produced archive', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ortha-zip-'));
        mkdirSync(join(dir, 'entries'));
        writeFileSync(join(dir, 'manifest.json'), '{"version":1}');
        writeFileSync(
            join(dir, 'entries', 'post.ndjson'),
            `${'{"a":1}\n'.repeat(200)}`
        );
        execFileSync('zip', ['-r', '-q', 'out.zip', 'manifest.json', 'entries'], {
            cwd: dir
        });

        const zip = readFileSync(join(dir, 'out.zip'));
        const read = readAll(zip);
        expect(read['manifest.json']).toBe('{"version":1}');
        expect(read['entries/post.ndjson']).toBe('{"a":1}\n'.repeat(200));
    });
});

describe('hostile archives', () => {
    /**
     * Hand-builds a one-entry archive so a malicious name or a lying size can be
     * planted — the writer refuses to produce either, which is the point.
     */
    function forge(options: {
        path: string;
        raw: Buffer;
        declaredUncompressed?: number;
        entryCount?: number;
    }): Buffer {
        const name = Buffer.from(options.path, 'utf8');
        const payload = deflateRawSync(options.raw);
        const uncompressed =
            options.declaredUncompressed ?? options.raw.length;

        const local = Buffer.alloc(30 + name.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(0, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(uncompressed, 22);
        local.writeUInt16LE(name.length, 26);
        name.copy(local, 30);

        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(0, 16);
        central.writeUInt32LE(payload.length, 20);
        central.writeUInt32LE(uncompressed, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(0, 42);
        name.copy(central, 46);

        const count = options.entryCount ?? 1;
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(count, 8);
        end.writeUInt16LE(count, 10);
        end.writeUInt32LE(central.length, 12);
        end.writeUInt32LE(local.length + payload.length, 16);

        return Buffer.concat([local, payload, central, end]);
    }

    it('refuses a path that climbs out of the archive', () => {
        const zip = forge({
            path: '../../etc/passwd',
            raw: Buffer.from('pwned')
        });

        expect(() => readZipDirectory(zip, limits)).toThrow(ZipReadError);
        expect(() => readZipDirectory(zip, limits)).toThrow(
            /points outside the archive/
        );
    });

    it('refuses an absolute path', () => {
        expect(() =>
            readZipDirectory(
                forge({ path: '/etc/passwd', raw: Buffer.from('x') }),
                limits
            )
        ).toThrow(/absolute path/);
    });

    it('refuses a Windows drive-letter path', () => {
        expect(() =>
            readZipDirectory(
                forge({ path: 'C:/windows/system32/x', raw: Buffer.from('x') }),
                limits
            )
        ).toThrow(/absolute path/);
    });

    it('refuses a name carrying a null byte', () => {
        expect(() =>
            readZipDirectory(
                forge({ path: 'ok.txt\0.exe', raw: Buffer.from('x') }),
                limits
            )
        ).toThrow(/null byte/);
    });

    it('refuses an entry declaring more than the per-entry ceiling', () => {
        expect(() =>
            readZipDirectory(
                forge({ path: 'big.txt', raw: Buffer.from('x'.repeat(64)) }),
                { ...limits, maxArchiveEntryBytes: 16 }
            )
        ).toThrow(/over the 16 limit/);
    });

    it('refuses an archive whose compression ratio is not real content', () => {
        // The bomb's trick: small enough to pass an upload limit, enormous once
        // unpacked. The ratio is the signal that arrives before the bytes.
        const zip = forge({
            path: 'bomb.txt',
            raw: Buffer.alloc(4 * 1024 * 1024, 0)
        });

        expect(() => readZipDirectory(zip, limits)).toThrow(
            /compressed far beyond/
        );
    });

    it('refuses more entries than the limit before reading any of them', () => {
        expect(() =>
            readZipDirectory(
                forge({
                    path: 'a.txt',
                    raw: Buffer.from('x'),
                    entryCount: 50
                }),
                { ...limits, maxArchiveEntries: 10 }
            )
        ).toThrow(/over the 10 limit/);
    });

    it('stops an entry that unpacks larger than it declares', () => {
        const zip = forge({
            path: 'liar.txt',
            raw: Buffer.from('x'.repeat(10_000)),
            declaredUncompressed: 10
        });
        const [entry] = readZipDirectory(zip, limits);

        expect(() => readZipEntry(zip, entry, limits)).toThrow(
            /unpacks larger than it declares/
        );
    });

    it('rejects a file that is not an archive at all', () => {
        // Long enough to reach the directory scan rather than the length guard,
        // so this exercises "no end-of-central-directory found".
        expect(() =>
            readZipDirectory(Buffer.from('not a zip, just text'.repeat(20)), limits)
        ).toThrow(/not a ZIP archive/);
        expect(looksLikeZip(Buffer.from('nope'))).toBe(false);
    });

    it('rejects a file too short to be an archive', () => {
        expect(() => readZipDirectory(Buffer.from('tiny'), limits)).toThrow(
            /too small to be a ZIP archive/
        );
    });
});
