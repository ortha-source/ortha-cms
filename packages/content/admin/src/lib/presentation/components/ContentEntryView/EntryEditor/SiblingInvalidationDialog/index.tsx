import { defineMessages, useIntl } from 'react-intl';
import { ConfirmDialog } from '@orthacms/design-system';
import type { InvalidatedSibling } from '../../../../../infrastructure/entryIssues';

const messages = defineMessages({
    title: {
        id: 'content.editor.siblingInvalidation.title',
        defaultMessage:
            'This leaves {count, plural, one {a published locale} other {published locales}} incomplete'
    },
    body: {
        id: 'content.editor.siblingInvalidation.body',
        defaultMessage:
            'Saving changes values every locale of this record shares. The published {locales} {count, plural, one {translation} other {translations}} would then be missing {fields}. {count, plural, one {It keeps} other {They keep}} serving the published version, but can’t be published again until that is fixed.'
    },
    unknownFields: {
        id: 'content.editor.siblingInvalidation.unknownFields',
        defaultMessage: 'a required value'
    },
    confirm: {
        id: 'content.editor.siblingInvalidation.confirm',
        defaultMessage: 'Save anyway'
    },
    cancel: {
        id: 'content.editor.siblingInvalidation.cancel',
        defaultMessage: 'Cancel'
    }
});

/** Props for {@link SiblingInvalidationDialog}. */
export type SiblingInvalidationDialogProps = {
    /** The siblings the refused save would invalidate; `null` closes it. */
    siblings: InvalidatedSibling[] | null;
    /** A field's display label, from its name. */
    labelFor: (name: string) => string;
    /** Dismissed — nothing is saved. */
    onCancel: () => void;
    /** Confirmed — the caller resends the save with the confirmation. */
    onConfirm: () => void;
};

/**
 * Asks before a save that the server refused because it would leave a
 * **published** locale sibling failing validation — a shared field cleared, or
 * a synced relation unlinked, that the other locale requires.
 *
 * It is a confirmation and not an error because the save is legitimate: the
 * value is shared, so changing it here changes it there. What the person has to
 * know is the cost, so the copy names the locales and the fields and says what
 * happens to them — their live version stays live, and the gap blocks the next
 * publish of each until it is filled.
 */
export function SiblingInvalidationDialog({
    siblings,
    labelFor,
    onCancel,
    onConfirm
}: SiblingInvalidationDialogProps) {
    const intl = useIntl();
    const list = siblings ?? [];
    const fieldNames = [
        ...new Set(
            list.flatMap((sibling) => sibling.issues.map((i) => i.field))
        )
    ];
    const count = list.length;
    return (
        <ConfirmDialog
            open={siblings !== null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
            title={intl.formatMessage(messages.title, { count })}
            description={intl.formatMessage(messages.body, {
                count,
                locales: intl.formatList(
                    list.map((sibling) => sibling.locale),
                    { type: 'conjunction' }
                ),
                fields: fieldNames.length
                    ? intl.formatList(
                          fieldNames.map((name) => `“${labelFor(name)}”`),
                          { type: 'conjunction' }
                      )
                    : intl.formatMessage(messages.unknownFields)
            })}
            confirmLabel={intl.formatMessage(messages.confirm)}
            cancelLabel={intl.formatMessage(messages.cancel)}
            onConfirm={onConfirm}
        />
    );
}
