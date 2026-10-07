import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, TableHead } from '@orthacms/design-system';
import { PICK_STATE, type PickState } from '../../../domain/translationPicks';

const messages = defineMessages({
    toggle: {
        id: 'i18n.publishTranslations.toggleLocale',
        defaultMessage: 'Publish {locale} for every record'
    },
    none: {
        id: 'i18n.publishTranslations.localeUnavailable',
        defaultMessage: 'Nothing to publish in {locale}'
    }
});

/**
 * One locale's column header in the picker: the locale code and a tri-state
 * checkbox that picks or clears that locale **for every selected record** that
 * has something to publish in it. Disabled when no record does — a column of
 * missing or already-live translations.
 */
export function LocaleColumnHeader({
    slug,
    name,
    state,
    onToggle
}: {
    slug: string;
    /** The locale's display name (falls back to the slug). */
    name: string;
    state: PickState;
    onToggle: (on: boolean) => void;
}) {
    const intl = useIntl();
    const unavailable = state === PICK_STATE.Unavailable;
    return (
        <TableHead className="text-center" title={name}>
            <span className="inline-flex flex-col items-center gap-1 py-1">
                <span className="text-xs font-medium uppercase">{slug}</span>
                <Checkbox
                    checked={
                        state === PICK_STATE.All
                            ? true
                            : state === PICK_STATE.Some
                              ? 'indeterminate'
                              : false
                    }
                    disabled={unavailable}
                    // A partly-picked column completes on click, the way the
                    // records table's select-all does.
                    onCheckedChange={() => onToggle(state !== PICK_STATE.All)}
                    aria-label={intl.formatMessage(
                        unavailable ? messages.none : messages.toggle,
                        { locale: name }
                    )}
                />
            </span>
        </TableHead>
    );
}
