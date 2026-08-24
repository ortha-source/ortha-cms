/**
 * The formats a transfer can be written in, and what each one honestly
 * promises.
 *
 * The capability table is not documentation — the export dialog reads it to
 * decide which depth toggles are even offered (asking for file bytes in a CSV
 * is a request no format can honour), and the server reads it to decide whether
 * a request needs an archive. One table, so the UI cannot offer something the
 * server will quietly drop.
 */

/** Format identifiers, as they appear on the wire. */
export const TRANSFER_FORMAT = {
    /** One JSON document: manifest plus every record. */
    Json: 'json',
    /** One record per line, manifest on the first line. Streams. */
    Ndjson: 'ndjson',
    /** An archive: manifest, per-type record files, and asset bytes. */
    Zip: 'zip',
    /** A flat table per type. Lossy by construction. */
    Csv: 'csv'
} as const;

/** A format identifier. */
export type TransferFormat =
    (typeof TRANSFER_FORMAT)[keyof typeof TRANSFER_FORMAT];

/** Every format, for validating a wire value. */
export const TRANSFER_FORMATS = Object.values(
    TRANSFER_FORMAT
) as TransferFormat[];

/** What a format can and cannot carry. */
export interface TransferFormatCapabilities {
    /** File extension, without the dot. */
    extension: string;
    /** Content type to serve it as. */
    mimeType: string;
    /** Whether asset bytes travel inside it. */
    carriesFileBytes: boolean;
    /**
     * Whether a document survives a round trip unchanged. False for CSV, whose
     * cells cannot hold a rich-text document or an ordered link list.
     */
    lossless: boolean;
    /** Whether it can express more than one type in one file. */
    multiType: boolean;
}

/** The capability table. */
export const TRANSFER_FORMAT_CAPABILITIES: Record<
    TransferFormat,
    TransferFormatCapabilities
> = {
    [TRANSFER_FORMAT.Json]: {
        extension: 'json',
        mimeType: 'application/json',
        carriesFileBytes: false,
        lossless: true,
        multiType: true
    },
    [TRANSFER_FORMAT.Ndjson]: {
        extension: 'ndjson',
        mimeType: 'application/x-ndjson',
        carriesFileBytes: false,
        lossless: true,
        multiType: true
    },
    [TRANSFER_FORMAT.Zip]: {
        extension: 'zip',
        mimeType: 'application/zip',
        carriesFileBytes: true,
        lossless: true,
        multiType: true
    },
    [TRANSFER_FORMAT.Csv]: {
        extension: 'csv',
        mimeType: 'text/csv',
        carriesFileBytes: false,
        lossless: false,
        // One file per type — a multi-type CSV export is a ZIP of CSVs, which
        // the server assembles; the format itself holds one table.
        multiType: false
    }
};

/** Whether a wire value names a format. */
export function isTransferFormat(value: unknown): value is TransferFormat {
    return (
        typeof value === 'string' &&
        (TRANSFER_FORMATS as string[]).includes(value)
    );
}
