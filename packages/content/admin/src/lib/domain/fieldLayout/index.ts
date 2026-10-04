import type { ContentField } from '../types/contentType';
import { CONTENT_FIELD_TYPE } from '../constants';
import { adminProps } from '../adminProps';

/**
 * How much of the form's two-column grid a field takes.
 *
 * - `full` — the whole line. The **default** for every field.
 * - `half` — one column, only when the schema asks with `admin.width: 'half'`.
 * - `fit` — the boolean segments, which size themselves to their two words;
 *   a frame the width of the form would only draw an empty box around them.
 *
 * The width is the schema author's call, not inferred from the field type. A
 * type-based rule was tried and guessed wrong in both directions — an email
 * went half while a slug, often just as short, went full — because the type
 * says what kind of value a field holds, not how long this project's values
 * run. Only the author knows that a `text` is a SKU and not a headline.
 */
export type FieldWidth = 'half' | 'fit' | 'full';

/** The widths a schema may ask for with `admin.width`. */
const DECLARED_WIDTHS: ReadonlySet<unknown> = new Set(['half', 'full']);

/** How much of the form's grid a field takes. */
export function fieldWidth(field: ContentField): FieldWidth {
    const declared = adminProps(field).width;
    if (DECLARED_WIDTHS.has(declared)) return declared as FieldWidth;
    return field.type === CONTENT_FIELD_TYPE.Boolean ? 'fit' : 'full';
}

/**
 * One line of the form: a single field, or two fields sharing it — a pair
 * of adjacent half-width fields, or the fields a schema grouped with
 * `admin.row`.
 */
export type FieldBlock =
    | { kind: 'single'; field: ContentField }
    | { kind: 'row'; key: string; fields: ContentField[] };

/**
 * The most fields one row holds; a further member starts a line of its own.
 * Two, because the form is a two-column grid: a row of three would add a
 * third set of column edges that no other line shares.
 */
export const MAX_ROW_FIELDS = 2;

/**
 * Lays the ordered fields out as lines.
 *
 * Two fields share a line when the schema says so, and in only two ways:
 *
 * - **Two adjacent half-width fields.** `width: 'half'` is the author's own
 *   word that a field is narrow — never inferred from its type (see
 *   {@link fieldWidth}) — so a half followed directly by another half fills
 *   the line the first would leave half empty. A full-width field, a boolean
 *   or a row member between them keeps them apart, and a third half starts
 *   the next line.
 * - **The same `admin.row` key.** A row sits where its **first** member does,
 *   and later members join it even when other fields fall between them in
 *   display order. A row with a single member is drawn as a plain field, so a
 *   typo in one key can't produce a half-empty line.
 *
 * Short fields are still never paired by **type**: an email beside a colour
 * would read as related whether or not they are.
 */
export function layoutFields(fields: ContentField[]): FieldBlock[] {
    const blocks: FieldBlock[] = [];
    const rows = new Map<string, Extract<FieldBlock, { kind: 'row' }>>();

    for (const field of fields) {
        const key = rowKey(field);
        const open = key ? rows.get(key) : undefined;
        if (open && open.fields.length < MAX_ROW_FIELDS) {
            open.fields.push(field);
            continue;
        }
        if (key) {
            const row = { kind: 'row' as const, key, fields: [field] };
            rows.set(key, row);
            blocks.push(row);
            continue;
        }
        // Two adjacent halves fill one line.
        const previous = blocks[blocks.length - 1];
        if (
            fieldWidth(field) === 'half' &&
            previous?.kind === 'single' &&
            fieldWidth(previous.field) === 'half'
        ) {
            blocks[blocks.length - 1] = {
                kind: 'row',
                key: `half:${previous.field.name}`,
                fields: [previous.field, field]
            };
            continue;
        }
        blocks.push({ kind: 'single', field });
    }

    return blocks.map((block) =>
        block.kind === 'row' && block.fields.length === 1
            ? { kind: 'single', field: block.fields[0] }
            : block
    );
}

/** The field's `admin.row` key, when it is a non-blank string. */
function rowKey(field: ContentField): string | undefined {
    const row = adminProps(field).row;
    return typeof row === 'string' && row.trim() !== '' ? row : undefined;
}
