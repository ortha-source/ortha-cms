import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Badge, ContainerHeader, cn } from '@orthacms/design-system';
import type { EntryRecord } from '../../../../../domain/types/contentType';
import {
    ENTRY_STATUS_VIEW,
    entryStatusView
} from '../../../../../domain/entryStatusView';
import { EntryStatusBadge } from '../../../EntryStatusBadge';

const messages = defineMessages({
    untitled: { id: 'content.editor.untitled', defaultMessage: 'Untitled' },
    published: {
        id: 'content.editor.meta.published',
        defaultMessage: 'Published {date}'
    },
    modified: {
        id: 'content.editor.meta.modified',
        defaultMessage:
            'Live version from {date} · saved changes not published yet'
    },
    draft: {
        id: 'content.editor.meta.draft',
        defaultMessage: 'Created {date} · never published'
    },
    created: {
        id: 'content.editor.meta.created',
        defaultMessage: 'Created {date}'
    }
});

/** A BCP-47 tag as its language's name in the admin's own language. */
function languageName(locale: string, uiLocale: string): string {
    try {
        return (
            new Intl.DisplayNames([uiLocale], { type: 'language' }).of(
                locale
            ) ?? locale
        );
    } catch {
        return locale;
    }
}

/**
 * The record at the top of the editor: its **title** as the page's `<h1>`, and
 * one line saying where it stands — the publish state, the locale, and when it
 * went live.
 *
 * The heading is the record's own title, read live from the form the way rows
 * are titled everywhere (`relationLabel`), falling back to "Untitled" — never
 * the content type's name, which the breadcrumb already carries. It used to be
 * the type's name, and on a desktop viewport it was screen-reader-only besides,
 * so nothing on the page said which record was open.
 *
 * `ContainerHeader` keeps the admin's one `<h1>` style; `keepTitle` stops it
 * folding into the top bar, since this title is data, not the page's name.
 */
export function EntryTitleBlock({
    title,
    entry,
    isCreate,
    publishable,
    actions,
    nav
}: {
    /** The record's title from its values, or empty for "Untitled". */
    title: string;
    entry?: EntryRecord;
    isCreate: boolean;
    publishable: boolean;
    /** Controls drawn beside the title below the breakpoint. */
    actions?: ReactNode;
    /** The "Sections" menu, on a work area too narrow for "On this page". */
    nav?: ReactNode;
}) {
    const intl = useIntl();
    const date = (iso?: string | null) =>
        iso ? intl.formatDate(iso, { dateStyle: 'medium' }) : null;

    const view = entryStatusView(isCreate ? undefined : entry);
    const created = date(entry?.createdAt);
    const sentence = isCreate
        ? null
        : !publishable
          ? created && intl.formatMessage(messages.created, { date: created })
          : view === ENTRY_STATUS_VIEW.Published
            ? intl.formatMessage(messages.published, {
                  date: date(entry?.publishedAt) ?? created
              })
            : view === ENTRY_STATUS_VIEW.Modified
              ? intl.formatMessage(messages.modified, {
                    date: date(entry?.publishedAt) ?? created
                })
              : created &&
                intl.formatMessage(messages.draft, { date: created });

    return (
        <div className="mb-6 flex min-w-0 flex-col gap-2.5">
            <ContainerHeader
                keepTitle
                className="mb-0 min-w-0"
                titleClassName={cn(
                    // The record's name, set larger than a page heading: it is
                    // the one thing on the page that says which record this is.
                    'break-words text-[28px] leading-[34px] tracking-[-0.012em]',
                    !title.trim() && 'text-muted-foreground'
                )}
                title={title.trim() || intl.formatMessage(messages.untitled)}
                // `undefined`, never `[]`: the header draws its actions row
                // for anything truthy.
                actions={actions ?? undefined}
            />
            <div
                data-testid="entry-title-meta"
                className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-muted-foreground"
            >
                {publishable ? (
                    <EntryStatusBadge entry={entry} isCreate={isCreate} />
                ) : null}
                {entry?.locale ? (
                    <Badge variant="line">
                        {entry.locale.toUpperCase()} ·{' '}
                        {languageName(entry.locale, intl.locale)}
                    </Badge>
                ) : null}
                {sentence ? <span>{sentence}</span> : null}
                {nav ? <span className="ml-auto">{nav}</span> : null}
            </div>
        </div>
    );
}
