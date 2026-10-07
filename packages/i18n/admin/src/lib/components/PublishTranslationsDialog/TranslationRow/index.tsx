import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, TableCell, TableRow } from '@orthacms/design-system';
import {
    isPicked,
    PICK_STATE,
    rowState,
    type PickRow,
    type Picks
} from '../../../domain/translationPicks';
import type { EntryTranslationMember } from '../../../types/locale';
import { TranslationCell } from './TranslationCell';

const messages = defineMessages({
    toggle: {
        id: 'i18n.publishTranslations.toggleRecord',
        defaultMessage: 'Publish every translation of {record}'
    }
});

/**
 * One selected record across the picker's locale columns: its name and own
 * locale, a tri-state checkbox over every translation it can publish, then a
 * {@link TranslationCell} per configured locale.
 *
 * The name cell is sticky, so with two dozen locales the reader scrolling right
 * still knows whose row they are in.
 */
export function TranslationRow({
    row,
    name,
    members,
    locales,
    picks,
    onToggleRow,
    onToggleCell
}: {
    row: PickRow;
    /** The record's display name (its title, else its id). */
    name: string;
    /** The record's translation group, by locale slug. */
    members: ReadonlyMap<string, EntryTranslationMember>;
    /** The columns, as `{ slug, name }`, in config order. */
    locales: readonly { slug: string; name: string }[];
    picks: Picks;
    onToggleRow: (on: boolean) => void;
    onToggleCell: (locale: string, on: boolean) => void;
}) {
    const intl = useIntl();
    const state = rowState(picks, row);
    return (
        <TableRow>
            <TableCell className="sticky left-0 z-10 bg-background">
                <span className="flex min-w-0 items-center gap-2">
                    <Checkbox
                        checked={
                            state === PICK_STATE.All
                                ? true
                                : state === PICK_STATE.Some
                                  ? 'indeterminate'
                                  : false
                        }
                        disabled={state === PICK_STATE.Unavailable}
                        onCheckedChange={() =>
                            onToggleRow(state !== PICK_STATE.All)
                        }
                        aria-label={intl.formatMessage(messages.toggle, {
                            record: name
                        })}
                    />
                    <span className="max-w-56 truncate" title={name}>
                        {name}
                    </span>
                    <span className="shrink-0 text-xs uppercase text-muted-foreground">
                        {row.locale}
                    </span>
                </span>
            </TableCell>
            {locales.map((locale) => (
                <TranslationCell
                    key={locale.slug}
                    member={members.get(locale.slug)}
                    recordName={name}
                    localeName={locale.name}
                    picked={isPicked(picks, row.id, locale.slug)}
                    onToggle={(on) => onToggleCell(locale.slug, on)}
                />
            ))}
        </TableRow>
    );
}
