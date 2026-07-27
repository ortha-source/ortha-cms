import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    required: {
        id: 'content.form.requiredMark',
        defaultMessage: 'required'
    }
});

/**
 * The visible "this field is required" marker in a field's label row.
 *
 * Deliberately **`aria-hidden`**: the control itself carries `aria-required`,
 * which is what a screen reader announces. Marking the asterisk up as well
 * would announce "required" twice on every required field. The `title` gives
 * sighted users who don't know the convention a way to check what `*` means.
 */
export function RequiredMark() {
    const intl = useIntl();
    const label = intl.formatMessage(messages.required);
    return (
        <span
            aria-hidden
            title={label}
            className="ml-0.5 select-none text-destructive"
        >
            *
        </span>
    );
}
