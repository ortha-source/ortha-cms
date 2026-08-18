import { defineMessages, useIntl } from 'react-intl';

/** Intl descriptors for the tab marker, co-located here. */
const messages = defineMessages({
    // Read out after the tab's own name, so a screen-reader user hears
    // "Relations, required fields still to fill". The asterisk itself is
    // `aria-hidden`: read literally it is the word "star", which says nothing.
    required: {
        id: 'content.entry.tabRequired',
        defaultMessage: 'required fields still to fill'
    }
});

/** Props for {@link EntryTabIssues}. */
export type EntryTabIssuesProps = {
    /** Whether any field on this tab still blocks publishing. */
    unmet: boolean;
};

/**
 * The marker on an entry-editor tab whose fields are not yet publishable — a
 * required field left empty, or any field holding an invalid value.
 *
 * An asterisk, which is already what a required field is marked with across
 * forms, so the tab bar borrows a convention the reader has met rather than
 * inventing one. **It is a glyph, not a tint**: a bare coloured dot would carry
 * its meaning only for people who can see it against the surrounding text,
 * which is the trap `SkillPicker` calls out for its own tinted trigger. The
 * `text-destructive` here reinforces the asterisk; it never has to carry it
 * alone.
 *
 * Renders nothing when the tab is satisfied, so a tab that is fine stays
 * visually quiet and the bar doesn't reserve width it isn't using.
 */
export function EntryTabIssues({ unmet }: EntryTabIssuesProps) {
    const intl = useIntl();

    if (!unmet) {
        return null;
    }

    return (
        // `-ml-1` against the trigger's own `gap-1.5`: an asterisk belongs
        // tight to the word it qualifies, not a control's width away from it.
        // `leading-none` so the glyph — which sits high in its line box —
        // centres against the label rather than riding above it.
        <span className="text-destructive -ml-1 leading-none">
            <span aria-hidden>*</span>
            <span className="sr-only">
                {intl.formatMessage(messages.required)}
            </span>
        </span>
    );
}
