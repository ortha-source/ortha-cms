import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@orthacms/design-system';
import type { SiblingSyncRefusal } from '../../../../../infrastructure/entryIssues';
import { contentEntryPath } from '../../../../../domain/contentEntryPath';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import { SyncChangeList } from './SyncChangeList';

const messages = defineMessages({
    syncTitle: {
        id: 'content.editor.siblingSync.title',
        defaultMessage:
            'This also changes {count, plural, one {another locale} other {# other locales}}'
    },
    recordsTitle: {
        id: 'content.editor.siblingSync.recordsTitle',
        defaultMessage:
            'This also changes {count, plural, one {another record} other {# other records}}'
    },
    syncBody: {
        id: 'content.editor.siblingSync.body',
        defaultMessage:
            '{fields} {count, plural, one {is} other {are}} shared by every language of this record, so saving also changes {count, plural, one {it} other {them}} in {locales}.'
    },
    sharedBody: {
        id: 'content.editor.siblingSync.sharedBody',
        defaultMessage:
            'Some values are the same in every language of this record, so saving updates them everywhere.'
    },
    recordsBody: {
        id: 'content.editor.siblingSync.recordsBody',
        defaultMessage:
            'Some links are kept in sync across languages, so saving also updates the records below. Check what changes in each — and untick any record you’d rather leave as it is.'
    },
    linkedRecordsBody: {
        id: 'content.editor.siblingSync.linkedRecordsBody',
        defaultMessage:
            'Some links are kept in sync across languages, so saving also updates the records below. Check what changes in each before you continue.'
    },
    sharedValues: {
        id: 'content.editor.siblingSync.sharedValues',
        defaultMessage: 'Shared values'
    },
    invalidTitle: {
        id: 'content.editor.siblingSync.invalidTitle',
        defaultMessage:
            'This leaves {count, plural, one {a published locale} other {published locales}} incomplete'
    },
    invalidBody: {
        id: 'content.editor.siblingSync.invalidBody',
        defaultMessage:
            'The published {locales} {count, plural, one {translation} other {translations}} would then be missing {fields}. {count, plural, one {It keeps} other {They keep}} serving the published version, but can’t be published again until that is fixed.'
    },
    unknownFields: {
        id: 'content.editor.siblingSync.unknownFields',
        defaultMessage: 'a required value'
    },
    confirm: {
        id: 'content.editor.siblingSync.confirm',
        defaultMessage: 'Save'
    },
    confirmAnyway: {
        id: 'content.editor.siblingSync.confirmAnyway',
        defaultMessage: 'Save anyway'
    },
    cancel: {
        id: 'content.editor.siblingSync.cancel',
        defaultMessage: 'Cancel'
    }
});

/** Props for {@link SiblingSyncDialog}. */
export type SiblingSyncDialogProps = {
    /** What the refused save would have done; `null` closes the dialog. */
    refusal: SiblingSyncRefusal | null;
    /** Display labels of the shared fields this save changes, in form order. */
    sharedFields: string[];
    /** A field's display label, from its name. */
    labelFor: (name: string) => string;
    /** Dismissed — nothing is saved. */
    onCancel: () => void;
    /**
     * Confirmed — the caller resends the write without asking, leaving out
     * the `optional` rows the person unticked (`skipped`, by entry id).
     */
    onConfirm: (skipped: string[]) => void;
    /** The confirm button's label, when the write is not a plain save. */
    confirmLabel?: string;
};

/**
 * The one confirmation before a write that reaches other rows — a shared
 * field changed or a synced relation relinked (the record's other locales), a
 * link edited from its far side (another record's locales), or a translation
 * created that records were waiting for.
 *
 * The server decides whether to ask: the editor sends the write with
 * `askBeforeSiblingSync`, and the server, which alone knows those rows, runs
 * it, records what every row would become, refuses, and rolls back. So the
 * dialog asks **once**, only when another row is really reached — and shows
 * what changes in each, values before and after, links gained and lost, and
 * the linked records a language is left without for want of a translation.
 *
 * Only a **filled-in gap** can be declined row by row (`optional`): leaving it
 * open is a state the sync allows. Every other row is kept consistent with
 * the record by the sync itself, so declining it would not stick — the next
 * save of any language would redo it — and the only honest choices are Save
 * and Cancel.
 *
 * A write that leaves a published row incomplete says what it will lack and
 * what happens to it — its live version stays live, its next publish is
 * blocked — and offers a destructive **Save anyway**.
 */
export function SiblingSyncDialog({
    refusal,
    sharedFields,
    labelFor,
    onCancel,
    onConfirm,
    confirmLabel
}: SiblingSyncDialogProps) {
    const intl = useIntl();
    // Every row in the preview opens in its own editor, in a new tab — read
    // off the editor's slot context, so the dialog also renders (without
    // links) where there is none.
    const slotContext = useEntrySlotContext();
    const workspaceId = slotContext?.workspaceId;
    const hrefFor = workspaceId
        ? (typeName: string, id: string) =>
              contentEntryPath(workspaceId, typeName, id)
        : undefined;
    const reached = refusal?.reached ?? [];
    const invalidated = refusal?.invalidated ?? [];
    const changes = useMemo(() => refusal?.changes ?? [], [refusal]);
    const others = changes.filter((change) => !change.sibling);
    const optional = others.some((change) => change.optional);

    // Unticked optional rows. Reset whenever a new refusal arrives, so a
    // second question never inherits the first one's answers.
    const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
    useEffect(() => setSkipped(new Set()), [refusal]);
    const toggle = (entryId: string, included: boolean) =>
        setSkipped((current) => {
            const next = new Set(current);
            if (included) next.delete(entryId);
            else next.add(entryId);
            return next;
        });

    const localeName = (slug: string) => {
        try {
            return intl.formatDisplayName(slug, { type: 'language' }) ?? slug;
        } catch {
            return slug;
        }
    };
    const quoted = (labels: string[]) =>
        intl.formatList(
            labels.map((label) => `“${label}”`),
            { type: 'conjunction' }
        );

    // The sync half — said whenever the server named the locales it reaches.
    // Without them (an invalidation refused on a save sent without asking),
    // the generic sentence is all that is known.
    const syncSentence = reached.length
        ? intl.formatMessage(messages.syncBody, {
              fields: sharedFields.length
                  ? quoted(sharedFields)
                  : intl.formatMessage(messages.sharedValues),
              count: sharedFields.length,
              locales: intl.formatList(reached.map(localeName), {
                  type: 'conjunction'
              })
          })
        : others.length
          ? ''
          : intl.formatMessage(messages.sharedBody);
    const recordsSentence = others.length
        ? intl.formatMessage(
              optional ? messages.recordsBody : messages.linkedRecordsBody
          )
        : '';

    let title: string;
    let description = [syncSentence, recordsSentence].filter(Boolean).join(' ');
    if (invalidated.length) {
        const fieldNames = [
            ...new Set(
                invalidated.flatMap((sibling) =>
                    sibling.issues.map((issue) => issue.field)
                )
            )
        ];
        title = intl.formatMessage(messages.invalidTitle, {
            count: invalidated.length
        });
        description = `${description} ${intl.formatMessage(
            messages.invalidBody,
            {
                count: invalidated.length,
                locales: intl.formatList(
                    invalidated.map((sibling) => localeName(sibling.locale)),
                    { type: 'conjunction' }
                ),
                fields: fieldNames.length
                    ? quoted(fieldNames.map(labelFor))
                    : intl.formatMessage(messages.unknownFields)
            }
        )}`.trim();
    } else if (others.length && !reached.length) {
        title = intl.formatMessage(messages.recordsTitle, {
            count: others.length
        });
    } else {
        title = intl.formatMessage(messages.syncTitle, {
            count: reached.length
        });
    }

    return (
        <Dialog
            open={refusal !== null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <DialogContent
                className="sm:max-w-xl"
                data-testid="sibling-sync-dialog"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {changes.length > 0 && (
                    <SyncChangeList
                        changes={changes}
                        invalidated={invalidated}
                        skipped={skipped}
                        onToggle={toggle}
                        localeName={localeName}
                        hrefFor={hrefFor}
                    />
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        variant={invalidated.length ? 'destructive' : 'default'}
                        onClick={() => onConfirm([...skipped])}
                    >
                        {confirmLabel ??
                            intl.formatMessage(
                                invalidated.length
                                    ? messages.confirmAnyway
                                    : messages.confirm
                            )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
