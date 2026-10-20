import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight, ChevronRight, ExternalLink, Info } from 'lucide-react';
import {
    Badge,
    buttonVariants,
    Checkbox,
    cn,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import type { RelationRef } from '../../../../../../../domain/types/contentType';
import { formatSyncValue } from '../../../../../../../domain/syncChangeValue';
import type { SyncChange } from '../../../../../../../infrastructure/entryIssues';
import { SYNC_REF_CHANGE, SyncRecordRef } from './SyncRecordRef';

const messages = defineMessages({
    siblingHeading: {
        id: 'content.editor.siblingSync.siblingHeading',
        defaultMessage: '{locale} version'
    },
    siblingMeta: {
        id: 'content.editor.siblingSync.siblingMeta',
        defaultMessage: 'Translation of this record'
    },
    siblingMetaTitled: {
        id: 'content.editor.siblingSync.siblingMetaTitled',
        defaultMessage: '{title} · translation of this record'
    },
    otherMeta: {
        id: 'content.editor.siblingSync.otherMeta',
        defaultMessage: '{type} · {locale}'
    },
    untitled: {
        id: 'content.editor.siblingSync.untitled',
        defaultMessage: 'Untitled'
    },
    published: {
        id: 'content.editor.siblingSync.published',
        defaultMessage: 'Published · will show as Modified'
    },
    incomplete: {
        id: 'content.editor.siblingSync.incomplete',
        defaultMessage: 'Left incomplete'
    },
    changed: {
        id: 'content.editor.siblingSync.changed',
        defaultMessage: 'Updated — too long to preview here'
    },
    empty: {
        id: 'content.editor.siblingSync.empty',
        defaultMessage: 'Empty'
    },
    before: {
        id: 'content.editor.siblingSync.before',
        defaultMessage: 'Now:'
    },
    after: {
        id: 'content.editor.siblingSync.after',
        defaultMessage: 'After saving:'
    },
    unresolved: {
        id: 'content.editor.siblingSync.unresolved',
        defaultMessage:
            '{records} {count, plural, one {has} other {have}} no {locale} version yet, so {count, plural, one {it won’t be} other {they won’t be}} linked here.'
    },
    unavailable: {
        id: 'content.editor.siblingSync.unavailable',
        defaultMessage: 'an unavailable record'
    },
    include: {
        id: 'content.editor.siblingSync.include',
        defaultMessage: 'Update {name}'
    },
    open: {
        id: 'content.editor.siblingSync.open',
        defaultMessage: 'Open {name} in a new tab'
    },
    summaryValues: {
        id: 'content.editor.siblingSync.summaryValues',
        defaultMessage: '{count, plural, one {# value} other {# values}}'
    },
    summaryLinks: {
        id: 'content.editor.siblingSync.summaryLinks',
        defaultMessage: '{count, plural, one {# link} other {# links}}'
    },
    summaryLeftOut: {
        id: 'content.editor.siblingSync.summaryLeftOut',
        defaultMessage: '{count} left out'
    }
});

/** Props for {@link SyncChangeItem}. */
export type SyncChangeItemProps = {
    change: SyncChange;
    /** A published row the write would leave incomplete. */
    incomplete: boolean;
    /** Whether an optional row is still ticked. */
    included: boolean;
    onToggle: (included: boolean) => void;
    localeName: (slug: string) => string;
    /** A record's own editor, by type and id — absent outside an editor. */
    hrefFor?: (typeName: string, id: string) => string;
    /** Whether the row's details are shown. */
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/**
 * One other row in the sync preview, laid out like a small card: which row
 * it is — a language version of this record, or another record (its title,
 * then its type and language) — with a link opening it in a new tab, whether
 * it is published, and what changes in it, field by field: a value as
 * "now → after saving", links as the records gained and lost (each with its
 * status and its own open link), and a plain note for the linked records it
 * is left without because they have no version in its language.
 *
 * An **optional** row (a gap a new translation fills) carries a checkbox,
 * labelled by the row's heading, so a person can leave it as it is.
 *
 * The details **fold** under the heading, which then says how much is inside
 * ("1 value · 2 links") — one save can relink a lot across a group, and a
 * list of open cards turns the dialog into a scroll. The trigger is the
 * heading itself; the checkbox, the badges and the open link stay outside
 * it, so no control sits inside another.
 */
export function SyncChangeItem({
    change,
    incomplete,
    included,
    onToggle,
    localeName,
    hrefFor,
    open,
    onOpenChange
}: SyncChangeItemProps) {
    const intl = useIntl();
    const locale = change.locale ? localeName(change.locale) : '';
    const heading = change.sibling
        ? intl.formatMessage(messages.siblingHeading, {
              locale: locale || change.typeLabel
          })
        : (change.title ?? intl.formatMessage(messages.untitled));
    const meta = change.sibling
        ? change.title
            ? intl.formatMessage(messages.siblingMetaTitled, {
                  title: change.title
              })
            : intl.formatMessage(messages.siblingMeta)
        : locale
          ? intl.formatMessage(messages.otherMeta, {
                type: change.typeLabel,
                locale
            })
          : change.typeLabel;
    const name = `${heading} · ${meta}`;
    const href = hrefFor?.(change.type, change.entryId);
    const quoted = (refs: RelationRef[]) =>
        intl.formatList(
            refs.map((ref) =>
                ref.missing
                    ? intl.formatMessage(messages.unavailable)
                    : `“${ref.title}”`
            ),
            { type: 'conjunction' }
        );
    const shown = (value: unknown) => {
        const text = formatSyncValue(value);
        return text === '' ? intl.formatMessage(messages.empty) : text;
    };

    const notes = change.links
        .filter((link) => link.unresolved.length > 0)
        .map((link) =>
            intl.formatMessage(messages.unresolved, {
                records: quoted(link.unresolved),
                count: link.unresolved.length,
                locale: locale || change.locale || ''
            })
        );
    const linkRows = change.links.filter(
        (link) => link.added.length > 0 || link.removed.length > 0
    );
    const linkCount = linkRows.reduce(
        (sum, link) => sum + link.added.length + link.removed.length,
        0
    );
    const leftOut = change.links.reduce(
        (sum, link) => sum + link.unresolved.length,
        0
    );
    const summary = [
        change.fields.length
            ? intl.formatMessage(messages.summaryValues, {
                  count: change.fields.length
              })
            : '',
        linkCount
            ? intl.formatMessage(messages.summaryLinks, { count: linkCount })
            : '',
        leftOut
            ? intl.formatMessage(messages.summaryLeftOut, { count: leftOut })
            : ''
    ]
        .filter(Boolean)
        .join(' · ');
    const hasDetails =
        change.fields.length > 0 || linkRows.length > 0 || notes.length > 0;

    return (
        <li className="flex items-start gap-3 py-3">
            {change.optional ? (
                <Checkbox
                    className="mt-0.5"
                    checked={included}
                    onCheckedChange={(next) => onToggle(next === true)}
                    aria-label={intl.formatMessage(messages.include, { name })}
                />
            ) : null}
            <Collapsible
                open={open && hasDetails}
                onOpenChange={onOpenChange}
                className="min-w-0 flex-1 space-y-2"
            >
                <div className="flex items-start gap-2">
                    {hasDetails ? (
                        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <ChevronRight
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-baseline gap-2">
                                    <span className="truncate text-sm font-medium">
                                        {heading}
                                    </span>
                                    {summary ? (
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {summary}
                                        </span>
                                    ) : null}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {meta}
                                </span>
                            </span>
                        </CollapsibleTrigger>
                    ) : (
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                                {heading}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {meta}
                            </p>
                        </div>
                    )}
                    {change.published ? (
                        <Badge variant="warning" className="shrink-0">
                            {intl.formatMessage(messages.published)}
                        </Badge>
                    ) : null}
                    {incomplete ? (
                        <Badge variant="destructive-soft" className="shrink-0">
                            {intl.formatMessage(messages.incomplete)}
                        </Badge>
                    ) : null}
                    {href ? (
                        <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                                buttonVariants({
                                    variant: 'ghost',
                                    size: 'icon'
                                }),
                                'size-7 shrink-0 text-muted-foreground hover:text-foreground'
                            )}
                            aria-label={intl.formatMessage(messages.open, {
                                name: heading
                            })}
                        >
                            <ExternalLink className="size-4" aria-hidden />
                        </a>
                    ) : null}
                </div>
                <CollapsibleContent className="space-y-2">
                    {change.fields.length > 0 || linkRows.length > 0 ? (
                        <dl className="space-y-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                            {change.fields.map((field) => {
                                const before = shown(field.before);
                                const after = shown(field.after);
                                return (
                                    <div key={`field-${field.field}`}>
                                        <dt className="text-xs font-medium text-muted-foreground">
                                            {field.label}
                                        </dt>
                                        <dd className="flex min-w-0 flex-wrap items-center gap-x-1.5 break-words">
                                            {before === null ||
                                            after === null ? (
                                                intl.formatMessage(
                                                    messages.changed
                                                )
                                            ) : (
                                                <>
                                                    <span className="sr-only">
                                                        {intl.formatMessage(
                                                            messages.before
                                                        )}{' '}
                                                    </span>
                                                    <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                                                        {before}
                                                    </span>{' '}
                                                    <ArrowRight
                                                        aria-hidden
                                                        className="size-3.5 shrink-0 text-muted-foreground"
                                                    />
                                                    <span className="sr-only">
                                                        {intl.formatMessage(
                                                            messages.after
                                                        )}{' '}
                                                    </span>
                                                    <span>{after}</span>
                                                </>
                                            )}
                                        </dd>
                                    </div>
                                );
                            })}
                            {linkRows.map((link) => (
                                <div key={`link-${link.field}`}>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        {link.label}
                                    </dt>
                                    <dd>
                                        <ul className="space-y-1 pt-0.5">
                                            {link.added.map((record) => (
                                                <SyncRecordRef
                                                    key={`added-${record.id}`}
                                                    record={record}
                                                    change={
                                                        SYNC_REF_CHANGE.Added
                                                    }
                                                    href={
                                                        link.target
                                                            ? hrefFor?.(
                                                                  link.target,
                                                                  record.id
                                                              )
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                            {link.removed.map((record) => (
                                                <SyncRecordRef
                                                    key={`removed-${record.id}`}
                                                    record={record}
                                                    change={
                                                        SYNC_REF_CHANGE.Removed
                                                    }
                                                    href={
                                                        link.target
                                                            ? hrefFor?.(
                                                                  link.target,
                                                                  record.id
                                                              )
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                        </ul>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    ) : null}
                    {notes.map((note, index) => (
                        <p
                            key={`note-${index}`}
                            className="flex items-start gap-1.5 text-xs text-muted-foreground"
                        >
                            <Info
                                aria-hidden
                                className="mt-px size-3.5 shrink-0"
                            />
                            <span>{note}</span>
                        </p>
                    ))}
                </CollapsibleContent>
            </Collapsible>
        </li>
    );
}
