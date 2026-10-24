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

/**
 * The row's facts, in two parts: the `flags` — what changes behaviour — as
 * quiet badges after the name, and the `details` of the type — options, a
 * relation's target — as text after the type in words, each led by a dot.
 */
export function FieldFactList({
    facts,
    part
}: {
    facts: FieldFact[];
    part: 'flags' | 'details';
}) {
    const intl = useIntl();
    const shown = facts.filter((fact) =>
        part === 'flags' ? FLAG[fact.kind] : !FLAG[fact.kind]
    );
    if (shown.length === 0) return null;
    if (part === 'flags')
        return (
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {shown.map((fact) => (
                    <Badge
                        key={fact.kind}
                        variant="muted"
                        size="xs"
                        className="font-normal text-foreground/80"
                    >
                        {intl.formatMessage(FLAG[fact.kind] ?? messages.hidden)}
                    </Badge>
                ))}
            </span>
        );
    return (
        <>
            {shown.map((fact) => {
                if (fact.kind === 'options') {
                    return (
                        <span key="options">
                            <span aria-hidden>· </span>
                            {intl.formatMessage(messages.options, {
                                count: fact.count
                            })}
                        </span>
                    );
                }
                if (fact.kind !== 'target') return null;
                return (
                    <span key="target">
                        <span aria-hidden>· </span>
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
        </>
    );
}
