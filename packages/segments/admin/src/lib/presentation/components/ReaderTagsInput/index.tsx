import {
    useRef,
    useState,
    type ClipboardEvent,
    type KeyboardEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import { cn } from '@orthacms/design-system';

const messages = defineMessages({
    placeholder: {
        id: 'segments.tags.placeholder',
        defaultMessage: 'Add a tag…'
    },
    remove: {
        id: 'segments.tags.remove',
        defaultMessage: 'Remove tag {tag}'
    },
    added: { id: 'segments.tags.added', defaultMessage: 'Added {tag}.' },
    removed: { id: 'segments.tags.removed', defaultMessage: 'Removed {tag}.' }
});

/** Splits typed or pasted text into tags: commas and line breaks separate. */
export function splitTags(text: string): string[] {
    return text
        .split(/[,\n\r]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
}

type ReaderTagsInputProps = {
    /** The input's id — what the field's `<label htmlFor>` names. */
    id: string;
    value: readonly string[];
    onChange: (next: string[]) => void;
    onBlur?: () => void;
    invalid?: boolean;
    describedBy?: string;
    disabled?: boolean;
};

/**
 * Reader tags as chips — one per identifier a reader may arrive with.
 *
 * **Enter or a comma** turns what was typed into a chip; **a paste** of a list
 * (commas or one per line, the way it comes out of the system that owns the
 * identifiers) becomes as many chips in one go, so a chip editor does not turn
 * forty plan codes into forty interactions. **Backspace** on an empty input
 * takes the last chip back into the input for editing, and each chip's ×
 * removes it and returns focus to the input, so the keyboard never lands on
 * `<body>`.
 *
 * A tag already present is not added twice — it would match nobody new. The
 * limits themselves (how many, how long) are the kernel's, checked by the form
 * through `validateSegment` like every other field rule.
 *
 * Additions and removals are announced, because a chip appearing is a change
 * a screen reader would otherwise not hear about.
 */
export function ReaderTagsInput({
    id,
    value,
    onChange,
    onBlur,
    invalid,
    describedBy,
    disabled
}: ReaderTagsInputProps) {
    const intl = useIntl();
    const input = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState('');
    const [announcement, setAnnouncement] = useState('');

    const add = (tags: readonly string[]) => {
        const next = [...value];
        const added: string[] = [];
        for (const tag of tags) {
            if (!next.includes(tag)) {
                next.push(tag);
                added.push(tag);
            }
        }
        if (added.length) {
            onChange(next);
            setAnnouncement(
                intl.formatMessage(messages.added, {
                    tag: intl.formatList(added)
                })
            );
        }
    };

    const commit = () => {
        const tags = splitTags(draft);
        setDraft('');
        if (tags.length) add(tags);
    };

    const remove = (tag: string) => {
        onChange(value.filter((existing) => existing !== tag));
        setAnnouncement(intl.formatMessage(messages.removed, { tag }));
        input.current?.focus();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            // Only when there is something to add: an Enter on an empty input
            // still submits the form, as it does in every other field.
            if (draft.trim()) {
                event.preventDefault();
                commit();
            } else if (event.key === ',') {
                event.preventDefault();
            }
            return;
        }
        if (event.key === 'Backspace' && draft === '' && value.length) {
            event.preventDefault();
            const last = value[value.length - 1];
            onChange(value.slice(0, -1));
            setDraft(last);
            setAnnouncement(
                intl.formatMessage(messages.removed, { tag: last })
            );
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const text = event.clipboardData.getData('text');
        if (!/[,\n\r]/.test(text)) return;
        event.preventDefault();
        add(splitTags(`${draft},${text}`));
        setDraft('');
    };

    return (
        <div
            className={cn(
                'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card p-1.5 shadow-xs transition-colors',
                'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15',
                invalid &&
                    'border-destructive focus-within:border-destructive focus-within:ring-destructive/30',
                disabled && 'cursor-not-allowed opacity-50'
            )}
            // A click on the box's padding lands in the input, as it would on a
            // plain text field.
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    input.current?.focus();
                }
            }}
        >
            {value.map((tag) => (
                <span
                    key={tag}
                    className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-muted pl-2 pr-0.5 font-mono text-xs text-foreground"
                >
                    <span className="truncate">{tag}</span>
                    <button
                        type="button"
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={intl.formatMessage(messages.remove, {
                            tag
                        })}
                        disabled={disabled}
                        onClick={() => remove(tag)}
                    >
                        <X className="size-3" aria-hidden />
                    </button>
                </span>
            ))}
            <input
                ref={input}
                id={id}
                type="text"
                value={draft}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                placeholder={intl.formatMessage(messages.placeholder)}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                className="h-6 min-w-[8ch] flex-1 bg-transparent px-1 font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => {
                    // Whatever was typed and not yet committed is a tag the
                    // author meant — leaving the field should not drop it.
                    commit();
                    onBlur?.();
                }}
            />
            <span role="status" aria-live="polite" className="sr-only">
                {announcement}
            </span>
        </div>
    );
}
