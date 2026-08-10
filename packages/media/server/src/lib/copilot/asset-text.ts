import type { Readable } from 'node:stream';

/**
 * Bytes a single `media_asset_read` call will decode.
 *
 * Not a politeness limit: a tool result goes straight into the next prompt, so
 * an uncapped read of a 40 MB CSV would blow the context window and cost real
 * money before failing. 256 KB is roughly 60k tokens of prose — already more
 * than most runs should spend on one file, and enough for any report or
 * configuration document someone would ask about.
 */
export const MAX_READABLE_BYTES = 256 * 1024;

/**
 * MIME types `media_asset_read` will decode, as an **allowlist**.
 *
 * A blocklist would be the wrong shape here. `MediaKind.classify` files
 * everything that is not audio, video, image or a known archive under
 * `document`, so the coarse kind cannot be the filter — a `.docx`, a `.pdf`
 * and a `.md` are all `document`, and only the last one is text. Naming what
 * we *can* read means a new binary format is refused by default rather than
 * decoded into mojibake the model will try to interpret.
 */
const READABLE_MIME_TYPES: ReadonlySet<string> = new Set([
    'application/json',
    'application/ld+json',
    'application/xml',
    'application/xhtml+xml',
    'application/yaml',
    'application/x-yaml',
    'application/csv'
]);

/** MIME prefixes that are text by definition — `text/plain`, `text/csv`, … */
const READABLE_MIME_PREFIXES: readonly string[] = ['text/'];

/** Whether {@link readAssetText} can decode an asset of this MIME type. */
export function isReadableMimeType(mimeType: string): boolean {
    // Parameters are legal on a stored MIME type (`text/csv; charset=utf-8`),
    // and the ones we care about are all on the essence.
    const essence = mimeType.split(';')[0].trim().toLowerCase();
    return (
        READABLE_MIME_TYPES.has(essence) ||
        READABLE_MIME_PREFIXES.some((prefix) => essence.startsWith(prefix))
    );
}

/** A decoded file, and whether the cap cut it short. */
export interface AssetText {
    /** The decoded contents, UTF-8. */
    text: string;
    /** True when the file was longer than {@link MAX_READABLE_BYTES}. */
    truncated: boolean;
    /** Bytes actually decoded — not the asset's full size when truncated. */
    bytesRead: number;
}

/** Raised when the bytes behind a text MIME type are not valid UTF-8. */
export class NotUtf8Error extends Error {
    constructor() {
        super('That file is not valid UTF-8 text.');
        this.name = 'NotUtf8Error';
    }
}

/**
 * Reads at most {@link MAX_READABLE_BYTES} from `stream` and decodes them as
 * UTF-8.
 *
 * **The cap is applied while reading, not after.** Buffering a whole asset and
 * then slicing would mean a 50 MB upload is fully in memory before we decide we
 * only wanted 256 KB of it — the failure mode being memory pressure on the API
 * process, triggered by anyone who can upload a file. The stream is destroyed
 * as soon as the cap is passed, so the provider stops transferring too.
 *
 * Decoding is **fatal**, because a MIME type is a claim rather than a fact:
 * anyone can upload a JPEG named `notes.txt`, and the honest answer is an error
 * naming the problem rather than a page of replacement characters the model
 * will earnestly try to summarise. The one exception is a truncated read, where
 * `stream: true` holds back an incomplete trailing sequence instead of throwing
 * — the cap lands at an arbitrary byte, and cutting a three-byte codepoint in
 * half must not turn a perfectly good UTF-8 file into an error.
 */
export async function readAssetText(
    stream: Readable,
    cap: number = MAX_READABLE_BYTES
): Promise<AssetText> {
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    let truncated = false;

    try {
        for await (const chunk of stream) {
            const buffer = chunk as Buffer;
            if (bytesRead + buffer.byteLength > cap) {
                chunks.push(buffer.subarray(0, cap - bytesRead));
                bytesRead = cap;
                truncated = true;
                break;
            }
            chunks.push(buffer);
            bytesRead += buffer.byteLength;
        }
    } finally {
        // Whether we broke out at the cap or the source ended, nothing else
        // will read this: release the provider's handle rather than leaving a
        // paused stream for the GC to notice.
        stream.destroy();
    }

    const bytes = Buffer.concat(chunks);
    try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        return {
            text: decoder.decode(bytes, { stream: truncated }),
            truncated,
            bytesRead
        };
    } catch {
        throw new NotUtf8Error();
    }
}
