import type { ContentField } from '../types/contentType';
import { CONTENT_FIELD_TYPE } from '../constants';
import { adminProps } from '../adminProps';

/**
 * How much of the form's two-column grid a field takes.
 *
 * - `half` — a bounded value: a number, an amount, a date, a date with a
 *   time, a single choice, a colour, an email address.
 * - `fit` — a control that sizes itself to its content (the boolean
 *   segments), so a frame the width of a column would only draw an empty box.
 * - `full` — prose and anything else whose length is the author's: text,
 *   rich text, JSON, multi-choice chips, relations.
 *
 * Two sizes, not one per type. Widths tuned to each value (240px for a
 * number, 384 for an email, …) were tried and gave the form a different
 * right edge on nearly every line; snapped to a grid there are exactly two
 * edges, the middle and the full width, and the column still says "short
 * answer" to the author.
 */
export type FieldWidth = 'half' | 'fit' | 'full';

/** Text widgets whose value is bounded, so a half column holds it. */
const HALF_TEXT_WIDGETS = new Set(['color', 'email']);

/** How much of the form's grid a field takes. */
export function fieldWidth(field: ContentField): FieldWidth {
    switch (field.type) {
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
        case CONTENT_FIELD_TYPE.Date:
        case CONTENT_FIELD_TYPE.Datetime:
        case CONTENT_FIELD_TYPE.Select:
            return 'half';
        case CONTENT_FIELD_TYPE.Boolean:
            return 'fit';
        case CONTENT_FIELD_TYPE.Text: {
            const widget = adminProps(field).widget;
            return widget && HALF_TEXT_WIDGETS.has(widget) ? 'half' : 'full';
        }
        default:
            return 'full';
    }
}

/**
 * One line of the form: a single field, or the fields a schema grouped into
 * a row with `admin.row`.
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
 * A row is **declared, never inferred**: only fields carrying the same
 * `admin.row` key share a line. Pairing short fields automatically would put
 * whatever happened to be adjacent side by side — an email beside a colour —
 * and two controls on one line read as related whether or not they are.
 *
 * A row sits where its **first** member does, and later members join it even
 * when other fields fall between them in display order. A row with a single
 * member is drawn as a plain field, so a typo in one key can't produce a
 * half-empty line.
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
