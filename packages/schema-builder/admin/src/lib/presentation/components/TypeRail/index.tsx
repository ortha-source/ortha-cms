import { defineMessages, useIntl } from 'react-intl';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { TypeRailItem } from './TypeRailItem';

const messages = defineMessages({
    label: { id: 'schemaBuilder.rail.label', defaultMessage: 'Content types' },
    collections: {
        id: 'schemaBuilder.rail.collections',
        defaultMessage: 'Collections'
    },
    pages: { id: 'schemaBuilder.rail.pages', defaultMessage: 'Pages' }
});

const SECTIONS = [
    { kind: 'collection', title: messages.collections },
    { kind: 'single', title: messages.pages }
] as const;

type Props = { types: readonly TypeDoc[]; selected?: string };

/** Every type, collections then pages, in registration order within each. */
export function TypeRail({ types, selected }: Props) {
    const intl = useIntl();
    return (
        <nav
            aria-label={intl.formatMessage(messages.label)}
            className="flex flex-col gap-4 rounded-xl border bg-card p-2 shadow-xs"
        >
            {SECTIONS.map(({ kind, title }) => {
                const ofKind = types.filter((type) => type.kind === kind);
                if (ofKind.length === 0) return null;
                const headingId = `schema-rail-${kind}`;
                return (
                    <section
                        key={kind}
                        aria-labelledby={headingId}
                        className="flex flex-col gap-0.5"
                    >
                        <h2
                            id={headingId}
                            className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground"
                        >
                            {intl.formatMessage(title)}
                        </h2>
                        <ul className="flex flex-col gap-0.5">
                            {ofKind.map((type) => (
                                <TypeRailItem
                                    key={type.name}
                                    type={type}
                                    selected={type.name === selected}
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </nav>
    );
}
