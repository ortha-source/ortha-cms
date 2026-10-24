import type { IntlShape } from 'react-intl';
import { sinceParts } from '@orthacms/utils-admin';
import { ageParts } from '../../utils/previewVerdict';

/**
 * When something last happened — "8 min ago", "yesterday", or a date once it
 * is more than a week old. The admin's shared `sinceParts`, so "checked" here
 * reads like every other timestamp in the product.
 */
export function formatSince(intl: IntlShape, iso: string): string {
    const parts = sinceParts(iso);
    return parts.kind === 'relative'
        ? intl.formatRelativeTime(parts.value, parts.unit, {
              numeric: 'auto',
              style: 'short'
          })
        : intl.formatDate(parts.date, {
              month: 'short',
              day: 'numeric',
              year: parts.withYear ? 'numeric' : undefined
          });
}

/**
 * How long a record has been flagged — always relative ("2 weeks ago"),
 * because the age is the point: it is how long the problem has been sitting
 * there, and a date makes the reader do the subtraction.
 */
export function formatAge(intl: IntlShape, iso: string): string {
    const [value, unit] = ageParts(iso);
    return intl.formatRelativeTime(value, unit, { numeric: 'auto' });
}
