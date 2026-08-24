/**
 * The ceilings a transfer runs under.
 *
 * Export and import need bounds for opposite reasons. An export is bounded so a
 * careless filter can't ask one request to stream a whole library into memory;
 * an import is bounded because the file is **untrusted** — a small archive can
 * describe an enormous one, and a parser with no ceiling is the bug that turns
 * a compressed file into an outage.
 *
 * Every value is overridable by the deployment; the defaults are chosen to be
 * comfortably above real editorial work and far below "the whole database".
 */

/** Bounds on one transfer. */
export interface TransferLimits {
    /** Records one export may reach, roots and related together. */
    maxEntries: number;
    /** Distinct assets one export may carry. */
    maxAssets: number;
    /** Total asset bytes one export may carry. */
    maxBytes: number;
    /** Records one import may read from a document. */
    maxImportRecords: number;
    /** Columns one flat row may have. */
    maxColumns: number;
    /** Bytes of an uploaded file, before decompression. */
    maxUploadBytes: number;
    /** Members an uploaded archive may hold. */
    maxArchiveEntries: number;
    /** Bytes one archive member may decompress to. */
    maxArchiveEntryBytes: number;
    /** Total bytes an archive may decompress to. */
    maxArchiveTotalBytes: number;
    /**
     * Largest decompressed-to-compressed ratio tolerated across the archive.
     *
     * The total-bytes cap alone is not enough: a zip bomb's whole trick is that
     * the compressed file is small enough to sail past an upload limit, so the
     * ratio is the signal that arrives *before* the bytes do.
     */
    maxCompressionRatio: number;
}

/** The shipped defaults. */
export const DEFAULT_TRANSFER_LIMITS: TransferLimits = {
    maxEntries: 5000,
    maxAssets: 2000,
    maxBytes: 512 * 1024 * 1024,
    maxImportRecords: 5000,
    maxColumns: 200,
    maxUploadBytes: 256 * 1024 * 1024,
    maxArchiveEntries: 10_000,
    maxArchiveEntryBytes: 128 * 1024 * 1024,
    maxArchiveTotalBytes: 1024 * 1024 * 1024,
    maxCompressionRatio: 200
};

/** Merges a deployment's overrides onto {@link DEFAULT_TRANSFER_LIMITS}. */
export function resolveLimits(
    overrides?: Partial<TransferLimits>
): TransferLimits {
    return { ...DEFAULT_TRANSFER_LIMITS, ...(overrides ?? {}) };
}

/** Raised when a request or a file exceeds a limit. */
export class TransferLimitError extends Error {
    constructor(
        message: string,
        /** Which limit was hit, for the caller's error mapping. */
        readonly limit: keyof TransferLimits
    ) {
        super(message);
        this.name = 'TransferLimitError';
    }
}
