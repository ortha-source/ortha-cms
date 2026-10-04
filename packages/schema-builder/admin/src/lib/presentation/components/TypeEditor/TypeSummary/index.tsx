import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { OriginBadge } from '../../OriginBadge';
import { TypeFlags } from './TypeFlags';

const messages = defineMessages({
    collection: {
        id: 'schemaBuilder.type.collection',
        defaultMessage: 'collection'
    },
    single: { id: 'schemaBuilder.type.single', defaultMessage: 'page' },
    name: { id: 'schemaBuilder.type.name', defaultMessage: 'Machine name' },
    path: { id: 'schemaBuilder.type.path', defaultMessage: 'Path' },
    description: {
        id: 'schemaBuilder.type.description',
        defaultMessage: 'Description'
    },
    none: { id: 'schemaBuilder.type.none', defaultMessage: '—' }
});

/** A type's own options: identity, description and the three flags. */
export function TypeSummary({ type }: { type: TypeDoc }) {
    const intl = useIntl();
    return (
        <section
            aria-labelledby="schema-type-title"
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
        >
            <div className="flex flex-wrap items-center gap-2">
                <h2 id="schema-type-title" className="text-lg font-semibold">
                    {type.label ?? type.name}
                </h2>
                <Badge variant="outline" className="font-normal">
                    {intl.formatMessage(messages[type.kind])}
                </Badge>
                <OriginBadge origin={type.origin} />
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">
                        {intl.formatMessage(messages.name)}
                    </dt>
                    <dd className="font-mono">{type.name}</dd>
                </div>
                {type.kind === 'single' && (
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground">
                            {intl.formatMessage(messages.path)}
                        </dt>
                        <dd className="font-mono">
                            {type.path ?? intl.formatMessage(messages.none)}
                        </dd>
                    </div>
                )}
                <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-muted-foreground">
                        {intl.formatMessage(messages.description)}
                    </dt>
                    <dd>
                        {type.description ?? intl.formatMessage(messages.none)}
                    </dd>
                </div>
            </dl>
            <TypeFlags type={type} />
        </section>
    );
}
