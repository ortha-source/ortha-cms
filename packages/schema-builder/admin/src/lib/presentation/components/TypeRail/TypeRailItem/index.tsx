import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { FileText, Table2 } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { OriginBadge } from '../../OriginBadge';

const messages = defineMessages({
    dirty: {
        id: 'schemaBuilder.rail.dirty',
        defaultMessage: 'Unsaved changes'
    },
    fields: {
        id: 'schemaBuilder.rail.fields',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    }
});

type Props = { type: TypeDoc; selected: boolean; dirty?: boolean };

/**
 * One type in the rail: a link, so a type is addressable and the back button
 * works. Its label, a dot while it has unsaved changes, a badge only when it
 * is not the builder's own (written by hand, or not created yet), and how
 * many fields it has.
 */
export function TypeRailItem({ type, selected, dirty }: Props) {
    const intl = useIntl();
    const Icon = type.kind === 'single' ? FileText : Table2;
    const count = type.fields.length;
    return (
        <li>
            <Link
                to={`/content-model/${type.name}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                    'flex h-8 items-center gap-2 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'bg-accent font-medium' : 'hover:bg-accent/60'
                )}
            >
                <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
                <span className="min-w-0 truncate">
                    {type.label ?? type.name}
                </span>
                {dirty && (
                    <span
                        role="img"
                        aria-label={intl.formatMessage(messages.dirty)}
                        className="size-1.5 shrink-0 rounded-full bg-amber-500"
                    />
                )}
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {type.origin !== 'builder' && (
                        <OriginBadge origin={type.origin} />
                    )}
                    <span
                        className="min-w-4 text-right text-xs font-normal tabular-nums text-muted-foreground"
                        title={intl.formatMessage(messages.fields, { count })}
                    >
                        <span aria-hidden>{count}</span>
                        <span className="sr-only">
                            {intl.formatMessage(messages.fields, { count })}
                        </span>
                    </span>
                </span>
            </Link>
        </li>
    );
}
