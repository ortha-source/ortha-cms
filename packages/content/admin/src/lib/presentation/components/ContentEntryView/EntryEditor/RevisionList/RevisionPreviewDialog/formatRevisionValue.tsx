import type { ReactNode } from 'react';
import type { IntlShape } from 'react-intl';
import { Badge } from '@ortha-cms/design-system';
import type { ContentField } from '../../../../../../domain/types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../../../../domain/constants';

/** True for a null / undefined / blank / empty-array value. */
function isEmpty(value: unknown): boolean {
    return (
        value == null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * Render one **scalar** snapshot field value for the revision preview, by field
 * type — a read-only, full (untruncated) counterpart to the records table's
 * `renderCell`. Relation fields are rendered separately (as a titled record
 * list) by the diff row, so this handles only value-bag types. An empty value
 * renders a muted "Empty" so a before/after pair always reads. `intl` is passed
 * in so this stays a pure renderer (no hook), the same shape as `renderCell`.
 */
export function formatRevisionValue(
    field: ContentField,
    value: unknown,
    intl: IntlShape
): ReactNode {
    if (isEmpty(value)) {
        return (
            <span className="text-muted-foreground">
                {intl.formatMessage({
                    id: 'content.revisions.preview.empty',
                    defaultMessage: 'Empty'
                })}
            </span>
        );
    }

    switch (field.type) {
        case CONTENT_FIELD_TYPE.Boolean:
            return (
                <Badge variant={value ? 'default' : 'secondary'}>
                    {String(value)}
                </Badge>
            );
        case CONTENT_FIELD_TYPE.Select:
            return <Badge variant="secondary">{String(value)}</Badge>;
        case CONTENT_FIELD_TYPE.Multiselect: {
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
        case CONTENT_FIELD_TYPE.Date:
            return intl.formatDate(String(value), { dateStyle: 'medium' });
        case CONTENT_FIELD_TYPE.Datetime:
            return intl.formatDate(String(value), {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        case CONTENT_FIELD_TYPE.Money:
            return intl.formatNumber(Number(value) / 100, {
                style: 'currency',
                currency: 'USD'
            });
        case CONTENT_FIELD_TYPE.Number:
            return intl.formatNumber(Number(value));
        case CONTENT_FIELD_TYPE.Json:
            return (
                <code className="block whitespace-pre-wrap break-words font-mono text-xs">
                    {JSON.stringify(value, null, 2)}
                </code>
            );
        case CONTENT_FIELD_TYPE.RichText:
        case CONTENT_FIELD_TYPE.Text:
        default:
            return (
                <span className="whitespace-pre-wrap break-words">
                    {String(value)}
                </span>
            );
    }
}
