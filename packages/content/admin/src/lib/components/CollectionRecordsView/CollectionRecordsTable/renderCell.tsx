import type { ReactNode } from 'react';
import type { IntlShape } from 'react-intl';
import { FileText } from 'lucide-react';
import { Badge } from '@ortha-cms/design-system';
import type { ContentField } from '../../../types/contentType';

/** The em-dash placeholder for an empty cell. */
const EMPTY = '—';

/** True for a null/undefined/blank value. */
function isEmpty(value: unknown): boolean {
    return value == null || value === '' ;
}

/**
 * Render one field value into a table cell, by field type: scalars inline
 * (truncated), `boolean`/`select`/`status` as badges, dates via the intl
 * formatter, relations as a label with a `+N` overflow, and the heavy
 * `richtext`/`json` types as a muted, iconified summary (they don't fit
 * a cell). An empty value renders a muted em-dash. `intl` is passed in so the
 * function stays a pure renderer (no hook).
 */
export function renderCell(
    field: ContentField,
    value: unknown,
    intl: IntlShape
): ReactNode {
    if (isEmpty(value)) {
        return <span className="text-muted-foreground">{EMPTY}</span>;
    }

    switch (field.type) {
        case 'boolean':
            return (
                <Badge variant={value ? 'default' : 'secondary'}>
                    {String(value)}
                </Badge>
            );
        case 'select':
            return <Badge variant="secondary">{String(value)}</Badge>;
        case 'multiselect': {
            const items = Array.isArray(value) ? value : [value];
            return (
                <span className="inline-flex flex-wrap items-center gap-1">
                    {items.map((item) => (
                        <Badge key={String(item)} variant="secondary">
                            {String(item)}
                        </Badge>
                    ))}
                </span>
            );
        }
        case 'date':
            return (
                <span className="text-muted-foreground">
                    {intl.formatDate(String(value), { dateStyle: 'medium' })}
                </span>
            );
        case 'datetime':
            return (
                <span className="text-muted-foreground">
                    {intl.formatDate(String(value), {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })}
                </span>
            );
        case 'money':
            return intl.formatNumber(Number(value) / 100, {
                style: 'currency',
                currency: 'USD'
            });
        case 'number':
            return intl.formatNumber(Number(value));
        case 'relation': {
            if (Array.isArray(value)) {
                const [first, ...rest] = value;
                return (
                    <span className="inline-flex items-center gap-1">
                        <span className="truncate">{String(first)}</span>
                        {rest.length > 0 ? (
                            <Badge variant="secondary">+{rest.length}</Badge>
                        ) : null}
                    </span>
                );
            }
            return <span className="truncate">{String(value)}</span>;
        }
        case 'json':
            return (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <FileText className="size-4" aria-hidden />
                    <span className="max-w-[24ch] truncate font-mono text-xs">
                        {JSON.stringify(value)}
                    </span>
                </span>
            );
        case 'richtext':
        case 'text':
        default:
            return (
                <span className="block max-w-[28ch] truncate">
                    {String(value)}
                </span>
            );
    }
}
