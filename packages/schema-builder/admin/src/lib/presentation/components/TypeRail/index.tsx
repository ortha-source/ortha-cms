import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Search } from 'lucide-react';
import { Button, Input } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { TypeRailItem } from './TypeRailItem';

const messages = defineMessages({
    label: { id: 'schemaBuilder.rail.label', defaultMessage: 'Content types' },
    create: {
        id: 'schemaBuilder.rail.create',
        defaultMessage: 'New content type'
    },
    find: { id: 'schemaBuilder.rail.find', defaultMessage: 'Find a type' },
    none: {
        id: 'schemaBuilder.rail.none',
        defaultMessage: 'No type by that name.'
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

/**
 * Every type, collections then pages, in registration order within each — a
 * column the height of the work area, with a search over the labels and
 * machine names on top and "New content type" pinned to its foot. The list
 * scrolls on its own, so neither moves.
 */
export function TypeRail({ types, selected, dirty, onCreate }: Props) {
    const intl = useIntl();
    const [query, setQuery] = useState('');
    const needle = query.trim().toLowerCase();
    const shown = needle
        ? types.filter((type) =>
              `${type.label ?? ''} ${type.name}`.toLowerCase().includes(needle)
          )
        : types;
    return (
        <nav
            data-keeps-unsaved-changes
            aria-label={intl.formatMessage(messages.label)}
            className="flex flex-col lg:h-full"
        >
            <div className="relative p-3 pb-1">
                <Search
                    className="pointer-events-none absolute left-5.5 top-1/2 mt-1 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={intl.formatMessage(messages.find)}
                    aria-label={intl.formatMessage(messages.find)}
                    className="h-8 pl-8"
                />
            </div>
            <div className="flex flex-col gap-4 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {SECTIONS.map(({ kind, title }) => {
                    const ofKind = shown.filter((type) => type.kind === kind);
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
                                className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
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
                {needle && shown.length === 0 && (
                    <p className="px-2 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.none)}
                    </p>
                )}
            </div>
            {onCreate && (
                <div className="p-3 pt-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground"
                        onClick={onCreate}
                    >
                        <Plus />
                        {intl.formatMessage(messages.create)}
                    </Button>
                </div>
            )}
        </nav>
    );
}
