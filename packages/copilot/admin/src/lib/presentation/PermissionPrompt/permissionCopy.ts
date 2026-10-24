import { defineMessages, type IntlShape } from 'react-intl';
import type { PermissionPreview } from '@orthacms/copilot-domain';

const messages = defineMessages({
    generic: {
        id: 'copilot.permission.asks',
        defaultMessage: 'Ortha CMS AI wants to change your content'
    },
    saveDraft: {
        id: 'copilot.permission.saveDraft',
        defaultMessage:
            'Ortha CMS AI wants to save {count, plural, one {# record as a draft} other {# records as drafts}}'
    },
    save: {
        id: 'copilot.permission.save',
        defaultMessage:
            'Ortha CMS AI wants to save {count, plural, one {# record} other {# records}}'
    },
    createDraft: {
        id: 'copilot.permission.createDraft',
        defaultMessage:
            'Ortha CMS AI wants to create {count, plural, one {# record as a draft} other {# records as drafts}}'
    },
    create: {
        id: 'copilot.permission.create',
        defaultMessage:
            'Ortha CMS AI wants to create {count, plural, one {# record} other {# records}}'
    },
    change: {
        id: 'copilot.permission.change',
        defaultMessage:
            'Ortha CMS AI wants to make {count, plural, one {# change} other {# changes}}'
    },
    landsDraft: {
        id: 'copilot.permission.landsDraft',
        defaultMessage:
            'Published versions stay live until someone publishes the drafts.'
    },
    landsLive: {
        id: 'copilot.permission.landsLive',
        defaultMessage: 'Readers see this as soon as it is saved.'
    },
    nothingYet: {
        id: 'copilot.permission.nothingYet',
        defaultMessage: 'Nothing has happened yet — it is waiting for you.'
    }
});

/** The prompt's two sentences: what would happen, and what it means. */
export interface PermissionCopy {
    /** "Ortha CMS AI wants to save 23 records as drafts". */
    title: string;
    /** "Published versions stay live until someone publishes the drafts." */
    consequence: string;
}

/** The content plugin's kinds, restated — this package imports no plugin. */
const CREATE = 'content.entry.create';
const SAVES = new Set(['content.entry.update', 'content.entry.bulk-save']);

/**
 * **Permission in words** (R7): the prompt says what will happen — "save 23
 * records as drafts" — and what that means for what readers see, instead of
 * naming the tool and dumping its arguments.
 *
 * Read off the server's preview: the kind says whether records are created or
 * saved, `records` how many, and `lands` whether a draft or the live page. A
 * kind it does not know is "make N changes"; no preview at all is the generic
 * sentence it always had, and the consequence falls back to "nothing has
 * happened yet" — true, and the one thing worth saying when nothing else is
 * known. It never claims a draft it was not told about.
 */
export function permissionCopy(
    intl: IntlShape,
    preview: PermissionPreview | undefined
): PermissionCopy {
    if (!preview) {
        return {
            title: intl.formatMessage(messages.generic),
            consequence: intl.formatMessage(messages.nothingYet)
        };
    }
    const count = preview.records;
    const draft = preview.lands === 'draft';
    const title = SAVES.has(preview.kind)
        ? intl.formatMessage(draft ? messages.saveDraft : messages.save, {
              count
          })
        : preview.kind === CREATE
          ? intl.formatMessage(draft ? messages.createDraft : messages.create, {
                count
            })
          : intl.formatMessage(messages.change, {
                count: preview.changes.length + preview.omitted
            });
    const consequence =
        preview.lands === 'draft'
            ? intl.formatMessage(messages.landsDraft)
            : preview.lands === 'live'
              ? intl.formatMessage(messages.landsLive)
              : intl.formatMessage(messages.nothingYet);
    return { title, consequence };
}
