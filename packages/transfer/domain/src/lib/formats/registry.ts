/**
 * Picking the implementation for a format.
 *
 * A lookup rather than a `switch` at each call site: adding a format should
 * touch this table and the capability table, and nothing else.
 */

import { TRANSFER_FORMAT, type TransferFormat } from './format';
import { csvParser, csvSerializer } from './csv-format';
import {
    jsonParser,
    jsonSerializer,
    ndjsonParser,
    ndjsonSerializer
} from './json-format';
import { zipParser, zipSerializer } from './zip-format';
import type { ExportSerializer, ImportParser } from './ports';

/** Serializer per format. */
export const EXPORT_SERIALIZERS: Record<TransferFormat, ExportSerializer> = {
    [TRANSFER_FORMAT.Json]: jsonSerializer,
    [TRANSFER_FORMAT.Ndjson]: ndjsonSerializer,
    [TRANSFER_FORMAT.Zip]: zipSerializer,
    [TRANSFER_FORMAT.Csv]: csvSerializer
};

/** Parser per format. */
export const IMPORT_PARSERS: Record<TransferFormat, ImportParser> = {
    [TRANSFER_FORMAT.Json]: jsonParser,
    [TRANSFER_FORMAT.Ndjson]: ndjsonParser,
    [TRANSFER_FORMAT.Zip]: zipParser,
    [TRANSFER_FORMAT.Csv]: csvParser
};

/** The serializer for a format. */
export function serializerFor(format: TransferFormat): ExportSerializer {
    return EXPORT_SERIALIZERS[format];
}

/** The parser for a format. */
export function parserFor(format: TransferFormat): ImportParser {
    return IMPORT_PARSERS[format];
}

/**
 * Guesses the format of an uploaded file from its name.
 *
 * A guess, and treated as one: it seeds the import dialog's format field, which
 * the reader can change. The bytes decide nothing here — an archive is detected
 * by its signature in `transfer-server`, where the bytes actually are.
 */
export function formatFromFilename(
    filename: string
): TransferFormat | undefined {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.json')) return TRANSFER_FORMAT.Json;
    if (lower.endsWith('.ndjson') || lower.endsWith('.jsonl'))
        return TRANSFER_FORMAT.Ndjson;
    if (lower.endsWith('.zip')) return TRANSFER_FORMAT.Zip;
    if (lower.endsWith('.csv')) return TRANSFER_FORMAT.Csv;
    return undefined;
}
