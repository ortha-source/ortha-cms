import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Badge } from '@orthacms/design-system';
import type { FieldFact } from '../../../../../../domain/fieldFacts';

const messages = defineMessages({
    required: {
        id: 'schemaBuilder.field.required',
        defaultMessage: 'Required'
    },
    localized: {
        id: 'schemaBuilder.field.localized',
        defaultMessage: 'Localized'
    },
    hidden: { id: 'schemaBuilder.field.hidden', defaultMessage: 'Hidden' },
    multiple: {
        id: 'schemaBuilder.field.multiple',
        defaultMessage: 'Multiple'
    },
    options: {
        id: 'schemaBuilder.field.options',
        defaultMessage: '{count, plural, one {# option} other {# options}}'
    },
    manyToOne: {
        id: 'schemaBuilder.field.manyToOne',
        defaultMessage: 'many-to-one → {to}'
    },
    oneToOne: {
        id: 'schemaBuilder.field.oneToOne',
        defaultMessage: 'one-to-one → {to}'
    },
    manyToMany: {
        id: 'schemaBuilder.field.manyToMany',
        defaultMessage: 'many-to-many → {to}'
    },
    inverse: {
        id: 'schemaBuilder.field.inverse',
        defaultMessage: 'mirrors {to}.{field}'
    }
});

const FLAG: Partial<Record<FieldFact['kind'], MessageDescriptor>> = {
    required: messages.required,
    localized: messages.localized,
    hidden: messages.hidden,
    multiple: messages.multiple
};

/** The row's facts: flags as outline badges, the rest as quiet text. */
export function FieldFactList({ facts }: { facts: FieldFact[] }) {
    const intl = useIntl();
    if (facts.length === 0) return null;
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {facts.map((fact) => {
                const flag = FLAG[fact.kind];
                if (flag) {
                    return (
                        <Badge
                            key={fact.kind}
                            variant="outline"
                            className="font-normal"
                        >
                            {intl.formatMessage(flag)}
                        </Badge>
                    );
                }
                if (fact.kind === 'options') {
                    return (
                        <span key="options">
                            {intl.formatMessage(messages.options, {
                                count: fact.count
                            })}
                        </span>
                    );
                }
                if (fact.kind !== 'target') return null;
                return (
                    <span key="target" className="font-mono">
                        {fact.inverseOf
                            ? intl.formatMessage(messages.inverse, {
                                  to: fact.to,
                                  field: fact.inverseOf
                              })
                            : intl.formatMessage(
                                  messages[fact.cardinality ?? 'manyToOne'],
                                  { to: fact.to }
                              )}
                    </span>
                );
            })}
        </span>
    );
}
