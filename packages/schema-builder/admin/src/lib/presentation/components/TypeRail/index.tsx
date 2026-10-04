import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { TypeRailItem } from './TypeRailItem';

const messages = defineMessages({
    label: { id: 'schemaBuilder.rail.label', defaultMessage: 'Content types' },
    create: {
        id: 'schemaBuilder.rail.create',
        defaultMessage: 'New content type'
    },
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

type Props = {
    types: readonly TypeDoc[];
    selected?: string;
    /** Types with unsaved changes. */
    dirty?: ReadonlySet<string>;
    /** Present when the person may add a type. */
    onCreate?: () => void;
};

/** Every type, collections then pages, in registration order within each. */
export function TypeRail({ types, selected, dirty, onCreate }: Props) {
    const intl = useIntl();
    return (
        <nav
            data-keeps-unsaved-changes
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
                                    dirty={dirty?.has(type.name)}
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
            {onCreate && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-muted-foreground"
                    onClick={onCreate}
                >
                    <Plus />
                    {intl.formatMessage(messages.create)}
                </Button>
            )}
        </nav>
    );
}
