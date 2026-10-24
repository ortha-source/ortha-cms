import { defineMessages, useIntl } from 'react-intl';
import { Label, RadioGroup, RadioGroupItem, cn } from '@orthacms/design-system';
import type { ApiTokenScope } from '../../../domain/types/apiToken';

const messages = defineMessages({
    read: { id: 'apiTokens.access.read', defaultMessage: 'Read-only' },
    readHint: {
        id: 'apiTokens.access.readHint',
        defaultMessage: 'Published records only. Right for websites.'
    },
    full: { id: 'apiTokens.access.full', defaultMessage: 'Full access' },
    fullHint: {
        id: 'apiTokens.access.fullHint',
        defaultMessage: 'Create, update and publish. For trusted servers.'
    }
});

const OPTIONS: {
    value: ApiTokenScope;
    title: keyof typeof messages;
    hint: keyof typeof messages;
}[] = [
    { value: 'read', title: 'read', hint: 'readHint' },
    { value: 'full', title: 'full', hint: 'fullHint' }
];

/**
 * Read-only vs Full access as two option cards — the radio and the sentence
 * saying what it allows in one target, so the choice that decides whether a
 * credential can publish is made knowingly rather than off a bare label.
 * The group is named by the field label (`labelId`).
 */
export function AccessChoice({
    id,
    labelId,
    value,
    onChange
}: {
    /** Prefix for the radios' ids. */
    id: string;
    labelId: string;
    value: ApiTokenScope;
    onChange: (next: ApiTokenScope) => void;
}) {
    const intl = useIntl();
    return (
        <RadioGroup
            aria-labelledby={labelId}
            value={value}
            onValueChange={(next) => onChange(next as ApiTokenScope)}
            className="grid gap-2.5 sm:grid-cols-2"
        >
            {OPTIONS.map((option) => {
                const on = value === option.value;
                const radioId = `${id}-${option.value}`;
                const titleId = `${radioId}-title`;
                const hintId = `${radioId}-hint`;
                return (
                    <Label
                        key={option.value}
                        htmlFor={radioId}
                        className={cn(
                            'flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 font-normal transition-colors hover:bg-muted/40',
                            on && 'border-foreground ring-1 ring-foreground'
                        )}
                    >
                        <RadioGroupItem
                            id={radioId}
                            value={option.value}
                            // Named by the title and described by the hint,
                            // rather than by the whole card's text run
                            // together.
                            aria-labelledby={titleId}
                            aria-describedby={hintId}
                            className="mt-0.5"
                        />
                        <span className="flex flex-col gap-0.5">
                            <span id={titleId} className="text-sm font-medium">
                                {intl.formatMessage(messages[option.title])}
                            </span>
                            <span
                                id={hintId}
                                className="text-xs text-muted-foreground"
                            >
                                {intl.formatMessage(messages[option.hint])}
                            </span>
                        </span>
                    </Label>
                );
            })}
        </RadioGroup>
    );
}
