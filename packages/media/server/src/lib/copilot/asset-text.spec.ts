import { Readable } from 'node:stream';
import {
    MAX_READABLE_BYTES,
    NotUtf8Error,
    isReadableMimeType,
    readAssetText
} from './asset-text';

/** A readable emitting `bytes` in fixed-size chunks, like a storage provider. */
function streamOf(bytes: Buffer, chunkSize = 64): Readable {
    const chunks: Buffer[] = [];
    for (let at = 0; at < bytes.byteLength; at += chunkSize) {
        chunks.push(bytes.subarray(at, at + chunkSize));
    }
    return Readable.from(chunks.length > 0 ? chunks : [Buffer.alloc(0)]);
}

describe('isReadableMimeType', () => {
    it.each([
        'text/plain',
        'text/markdown',
        'text/csv',
        'text/html',
        'application/json',
        'application/ld+json',
        'application/xml',
        'application/yaml'
    ])('accepts %s', (mimeType) => {
        expect(isReadableMimeType(mimeType)).toBe(true);
    });

    // The allowlist exists because `MediaKind.classify` files a PDF, a Word
    // document and a Markdown file all as `document` — the coarse kind cannot
    // be the filter, so a new binary format must be refused by default.
    it.each([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/svg+xml',
        'video/mp4',
        'application/zip',
        'application/octet-stream'
    ])('refuses %s', (mimeType) => {
        expect(isReadableMimeType(mimeType)).toBe(false);
    });

    it('ignores parameters on the MIME type', () => {
        expect(isReadableMimeType('text/csv; charset=utf-8')).toBe(true);
        expect(isReadableMimeType('application/pdf; version=1.7')).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(isReadableMimeType('TEXT/Markdown')).toBe(true);
    });
});

describe('readAssetText', () => {
    it('decodes a whole file', async () => {
        const result = await readAssetText(streamOf(Buffer.from('# Notes\n')));

        expect(result).toEqual({
            text: '# Notes\n',
            truncated: false,
            bytesRead: 8
        });
    });

    it('decodes multi-byte characters spanning chunk boundaries', async () => {
        const text = '→ résumé — ✓ '.repeat(40);
        const result = await readAssetText(streamOf(Buffer.from(text), 7));

        expect(result.text).toBe(text);
        expect(result.truncated).toBe(false);
    });

    it('reports an empty file rather than failing', async () => {
        const result = await readAssetText(streamOf(Buffer.alloc(0)));

        expect(result).toEqual({ text: '', truncated: false, bytesRead: 0 });
    });

    describe('the byte cap', () => {
        it('cuts a file longer than the cap short and says so', async () => {
            const result = await readAssetText(
                streamOf(Buffer.from('a'.repeat(500))),
                100
            );

            expect(result.text).toBe('a'.repeat(100));
            expect(result.truncated).toBe(true);
            expect(result.bytesRead).toBe(100);
        });

        it('does not report a file of exactly the cap as truncated', async () => {
            const result = await readAssetText(
                streamOf(Buffer.from('a'.repeat(100))),
                100
            );

            expect(result.truncated).toBe(false);
            expect(result.bytesRead).toBe(100);
        });

        // The cap lands at an arbitrary byte, so it will sometimes fall inside
        // a multi-byte codepoint. A perfectly valid UTF-8 file must not become
        // an error because of where we stopped reading.
        it('drops an incomplete trailing codepoint instead of throwing', async () => {
            // '→' is three bytes, so a cap of 4 lands one byte into it.
            const result = await readAssetText(
                streamOf(Buffer.from('ab→cd')),
                4
            );

            expect(result.text).toBe('ab');
            expect(result.truncated).toBe(true);
        });

        // Buffering the whole asset and slicing afterwards would put a 50 MB
        // upload in memory before deciding we wanted 256 KB of it — memory
        // pressure anyone with upload rights could trigger.
        it('stops pulling from the stream once the cap is passed', async () => {
            let pulled = 0;
            const stream = Readable.from(
                (function* () {
                    for (let i = 0; i < 1000; i++) {
                        pulled++;
                        yield Buffer.from('a'.repeat(64));
                    }
                })()
            );

            await readAssetText(stream, 128);

            // A couple of chunks of readahead is normal; a thousand is not.
            expect(pulled).toBeLessThan(10);
        });

        it('destroys the stream so the provider handle is released', async () => {
            const stream = streamOf(Buffer.from('a'.repeat(500)));

            await readAssetText(stream, 100);

            expect(stream.destroyed).toBe(true);
        });

        it('defaults to MAX_READABLE_BYTES', async () => {
            const result = await readAssetText(
                streamOf(Buffer.alloc(MAX_READABLE_BYTES + 10, 0x61), 4096)
            );

            expect(result.bytesRead).toBe(MAX_READABLE_BYTES);
            expect(result.truncated).toBe(true);
        });
    });

    // A MIME type is a claim, not a fact: anyone can upload a JPEG named
    // `notes.txt`. An error naming the problem beats a page of replacement
    // characters the model would earnestly try to summarise.
    describe('invalid UTF-8', () => {
        it('refuses bytes that are not valid UTF-8', async () => {
            const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x41]);

            await expect(readAssetText(streamOf(bytes))).rejects.toBeInstanceOf(
                NotUtf8Error
            );
        });

        it('refuses a truncated read whose bytes are invalid, not merely cut', async () => {
            const bytes = Buffer.concat([
                Buffer.from([0xc3, 0x28]), // a lone continuation byte
                Buffer.from('a'.repeat(200))
            ]);

            await expect(
                readAssetText(streamOf(bytes), 100)
            ).rejects.toBeInstanceOf(NotUtf8Error);
        });
    });
});
