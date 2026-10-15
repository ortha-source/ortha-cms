import { defineMessages, useIntl } from 'react-intl';
import { ConfirmDialog } from '@orthacms/design-system';
import type { SiblingSyncRefusal } from '../../../../../infrastructure/entryIssues';

const messages = defineMessages({
    syncTitle: {
        id: 'content.editor.siblingSync.title',
        defaultMessage:
            'This also changes {count, plural, one {another locale} other {# other locales}}'
    },
    syncBody: {
        id: 'content.editor.siblingSync.body',
        defaultMessage:
            'Shared fields and synced relations aren’t translated. Saving changes {fields} in {locales} too.'
    },
    sharedBody: {
        id: 'content.editor.siblingSync.sharedBody',
        defaultMessage:
            'Saving changes values every locale of this record shares.'
    },
    sharedValues: {
        id: 'content.editor.siblingSync.sharedValues',
        defaultMessage: 'these shared values'
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
    /** Confirmed — the caller resends the save without asking. */
    onConfirm: () => void;
};

/**
 * The one confirmation before a save that reaches other locales of the
 * record — a shared field changed, or a synced relation relinked.
 *
 * The server decides whether to ask: the editor sends the save with
 * `askBeforeSiblingSync`, and the server, which alone knows the siblings,
 * refuses it with everything it would have done — the live locales it changes
 * and the published ones it would leave invalid. So the dialog asks **once**,
 * and only when another locale is really reached; it used to ask about the
 * sync from the client and then, after the server refused, ask again about
 * the damage.
 *
 * Two variants, because the stakes differ. A plain sync names the fields and
 * the locales and offers **Save**. A sync that leaves a published translation
 * incomplete says what each one will lack and what happens to it — its live
 * version stays live, its next publish is blocked — and offers a destructive
 * **Save anyway**.
 */
export function SiblingSyncDialog({
    refusal,
    sharedFields,
    labelFor,
    onCancel,
    onConfirm
}: SiblingSyncDialogProps) {
    const intl = useIntl();
    const reached = refusal?.reached ?? [];
    const invalidated = refusal?.invalidated ?? [];
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
              locales: intl.formatList(reached, { type: 'conjunction' })
          })
        : intl.formatMessage(messages.sharedBody);

    let title: string;
    let description: string;
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
        description = `${syncSentence} ${intl.formatMessage(
            messages.invalidBody,
            {
                count: invalidated.length,
                locales: intl.formatList(
                    invalidated.map((sibling) => sibling.locale),
                    { type: 'conjunction' }
                ),
                fields: fieldNames.length
                    ? quoted(fieldNames.map(labelFor))
                    : intl.formatMessage(messages.unknownFields)
            }
        )}`;
    } else {
        title = intl.formatMessage(messages.syncTitle, {
            count: reached.length
        });
        description = syncSentence;
    }

    return (
        <ConfirmDialog
            open={refusal !== null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
            title={title}
            description={description}
            confirmLabel={intl.formatMessage(
                invalidated.length ? messages.confirmAnyway : messages.confirm
            )}
            confirmVariant={invalidated.length ? 'destructive' : 'default'}
            cancelLabel={intl.formatMessage(messages.cancel)}
            onConfirm={onConfirm}
        />
    );
}
