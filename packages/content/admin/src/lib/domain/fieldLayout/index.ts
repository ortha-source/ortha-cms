import type { ContentField } from '../types/contentType';
import { CONTENT_FIELD_TYPE } from '../constants';
import { adminProps } from '../adminProps';

/**
 * How wide a field's control is drawn when it stands on a line of its own.
 *
 * - `narrow` — a short scalar whose value is a handful of characters: a
 *   number, an amount, a date, a colour.
 * - `medium` — a value longer than that but still bounded: a date with a
 *   time, a single choice, an email address.
 * - `fit` — a control that sizes itself to its content (the boolean
 *   segments), so a full-width frame would only draw an empty box.
 * - `full` — prose and anything else whose length is the author's: text,
 *   rich text, JSON, multi-choice chips, relations.
 *
 * The width is an affordance, not decoration: a box as wide as a paragraph
 * tells the author a paragraph is expected.
 */
export type FieldWidth = 'narrow' | 'medium' | 'fit' | 'full';

/** Text widgets whose value is bounded, mapped to the width that fits it. */
const TEXT_WIDGET_WIDTH: Record<string, FieldWidth> = {
    color: 'narrow',
    email: 'medium'
};

/** The width a field's control takes on a line of its own. */
export function fieldWidth(field: ContentField): FieldWidth {
    switch (field.type) {
        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
        case CONTENT_FIELD_TYPE.Date:
            return 'narrow';
        case CONTENT_FIELD_TYPE.Datetime:
        case CONTENT_FIELD_TYPE.Select:
            return 'medium';
        case CONTENT_FIELD_TYPE.Boolean:
            return 'fit';
        case CONTENT_FIELD_TYPE.Text: {
            const widget = adminProps(field).widget;
            return (widget && TEXT_WIDGET_WIDTH[widget]) || 'full';
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

/** The most fields one row holds; a row past it wraps onto the next line. */
export const MAX_ROW_FIELDS = 3;

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
