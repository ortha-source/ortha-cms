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
 * The format an uploaded file's name claims, if it claims one.
 *
 * Named a guess, but it is not treated as one. Its only caller is
 * `transfer-server`'s `readUpload`, which reads
 * `formatFromFilename(name) ?? sniffTextFormat(bytes)` — so among the three
 * text formats a name that resolves here **decides**, and the bytes are only
 * consulted when it returns `undefined`. There is no format field on the
 * import side for it to seed: the request carries a file, a conflict policy
 * and a relation policy, and nothing else. (The export dialog has one; import
 * does not.)
 *
 * The bytes do win where being wrong is expensive: an archive is detected by
 * its signature before this is called at all, so a `.zip` renamed to `.json`
 * is still read as an archive.
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
