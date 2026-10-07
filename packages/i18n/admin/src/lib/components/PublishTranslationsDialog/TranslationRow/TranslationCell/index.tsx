import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, TableCell } from '@orthacms/design-system';
import {
    entryStatusView,
    ENTRY_STATUS_VIEW,
    ENTRY_STATUS_VIEW_LABEL
} from '@orthacms/content-admin';
import type { EntryTranslationMember } from '../../../../types/locale';

const messages = defineMessages({
    pick: {
        id: 'i18n.publishTranslations.pickCell',
        defaultMessage: 'Publish {record} in {locale} ({status})'
    },
    missing: {
        id: 'i18n.publishTranslations.missing',
        defaultMessage: 'Not translated'
    }
});

/**
 * One (record, locale) cell of the picker. Three shapes, by what the locale
 * holds:
 *
 * - **missing** — no translation; a dash, nothing to pick;
 * - **live** — published and current; its status, nothing to pick (the dry run
 *   would only answer "already published");
 * - **draft / modified** — a checkbox, with the state under it so a record
 *   whose live copy is being replaced reads differently from one going out
 *   for the first time.
 */
export function TranslationCell({
    member,
    recordName,
    localeName,
    picked,
    onToggle
}: {
    /** The group's row in this locale, if it has one. */
    member: EntryTranslationMember | undefined;
    /** The record's name, for the checkbox's accessible name. */
    recordName: string;
    /** The locale's display name. */
    localeName: string;
    picked: boolean;
    onToggle: (on: boolean) => void;
}) {
    const intl = useIntl();
    if (!member) {
        return (
            <TableCell className="text-center text-muted-foreground">
                <span aria-hidden>—</span>
                <span className="sr-only">
                    {intl.formatMessage(messages.missing)}
                </span>
            </TableCell>
        );
    }
    const view = entryStatusView(member);
    const status = intl.formatMessage(ENTRY_STATUS_VIEW_LABEL[view]);
    if (view === ENTRY_STATUS_VIEW.Published) {
        return (
            <TableCell className="text-center text-xs text-muted-foreground">
                {status}
            </TableCell>
        );
    }
    return (
        <TableCell className="text-center">
            <span className="inline-flex flex-col items-center gap-1">
                <Checkbox
                    checked={picked}
                    onCheckedChange={(next) => onToggle(next === true)}
                    aria-label={intl.formatMessage(messages.pick, {
                        record: recordName,
                        locale: localeName,
                        status
                    })}
                />
                <span
                    className="text-[11px] leading-none text-muted-foreground"
                    aria-hidden
                >
                    {status}
                </span>
            </span>
        </TableCell>
    );
}
