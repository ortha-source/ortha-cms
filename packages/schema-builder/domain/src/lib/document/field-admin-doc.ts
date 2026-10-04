/**
 * `admin.*` on a field — what the stock admin reads, plus anything else a
 * project attached. Unknown keys are kept verbatim through a round trip; the
 * builder edits only the ones listed here.
 */
export interface FieldAdminDoc {
    label?: string;
    description?: string;
    placeholder?: string;
    widget?: string;
    hidden?: boolean;
    width?: 'half' | 'full';
    row?: string;
    group?: string;
    [extra: string]: unknown;
}
