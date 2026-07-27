import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Trash2 } from 'lucide-react';
import { Button, Input } from '@ortha-cms/design-system';
import { KEY } from '../../../utils/constants';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.link.label',
        defaultMessage: 'Link URL'
    },
    placeholder: {
        id: 'wysiwyg.link.placeholder',
        defaultMessage: 'https://…'
    },
    apply: {
        id: 'wysiwyg.link.apply',
        defaultMessage: 'Apply link'
    },
    remove: {
        id: 'wysiwyg.link.remove',
        defaultMessage: 'Remove link'
    }
});

/**
 * The URL field inside the selection toolbar. Purely presentational — the
 * toolbar owns the saved selection, because this input necessarily takes focus
 * away from the text the link is going on.
 */
export function LinkForm({
    value,
    hasLink,
    onChange,
    onSubmit,
    onRemove,
    onCancel
}: {
    value: string;
    /** Whether the caret is already inside a link (offers Remove). */
    hasLink: boolean;
    onChange(value: string): void;
    onSubmit(): void;
    onRemove(): void;
    onCancel(): void;
}) {
    const intl = useIntl();
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ref.current?.focus();
        ref.current?.select();
    }, []);

    return (
        <div className="flex items-center gap-1 p-1">
            <Input
                ref={ref}
                value={value}
                type="url"
                inputMode="url"
                aria-label={intl.formatMessage(messages.label)}
                placeholder={intl.formatMessage(messages.placeholder)}
                className="h-7 w-56 text-xs shadow-none"
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === KEY.Enter) {
                        event.preventDefault();
                        onSubmit();
                    }
                    if (event.key === KEY.Escape) {
                        event.preventDefault();
                        onCancel();
                    }
                }}
            />
            <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={intl.formatMessage(messages.apply)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onSubmit}
            >
                <Check aria-hidden className="size-4" />
            </Button>
            {hasLink && (
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={intl.formatMessage(messages.remove)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onRemove}
                >
                    <Trash2 aria-hidden className="size-4" />
                </Button>
            )}
        </div>
    );
}
