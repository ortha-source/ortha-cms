import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import { VIEW_NAME_MAX_LENGTH } from '../../../../../domain/types/savedView';

/** Intl descriptors for {@link TabRenameField}, co-located. */
const messages = defineMessages({
    label: {
        id: 'content.views.rename.label',
        defaultMessage: 'View name'
    }
});

/**
 * The tab of a view being renamed — the name as a text field, where the name
 * is. **Enter** (or leaving the field) saves, **Escape** cancels; an empty or
 * unchanged name saves nothing. While the save is in flight the field stays
 * up, read-only, so a refusal (a name already taken) leaves it open with what
 * the reader typed instead of snapping back.
 */
export function TabRenameField({
    initial,
    onCommit,
    onCancel
}: {
    /** The current name. */
    initial: string;
    /** Saves the new name; resolves whether the server took it. */
    onCommit: (name: string) => Promise<boolean>;
    /** Leaves the name as it was. */
    onCancel: () => void;
}) {
    const intl = useIntl();
    const [value, setValue] = useState(initial);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    // Enter commits and then blurs; without the latch the blur commits twice.
    const done = useRef(false);

    const commit = async () => {
        if (done.current || busy) return;
        const name = value.trim();
        if (!name || name === initial) {
            done.current = true;
            onCancel();
            return;
        }
        setBusy(true);
        const ok = await onCommit(name);
        setBusy(false);
        if (ok) {
            done.current = true;
            return;
        }
        inputRef.current?.focus();
        inputRef.current?.select();
    };

    return (
        <span className="inline-flex h-9 shrink-0 items-center px-1">
            <input
                ref={inputRef}
                autoFocus
                aria-label={intl.formatMessage(messages.label)}
                value={value}
                maxLength={VIEW_NAME_MAX_LENGTH}
                readOnly={busy}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => void commit()}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void commit();
                    } else if (event.key === 'Escape') {
                        // The panel, a dialog — nothing else should take this
                        // Escape as its own.
                        event.preventDefault();
                        event.stopPropagation();
                        done.current = true;
                        onCancel();
                    }
                }}
                size={Math.max(8, Math.min(value.length + 1, 32))}
                className={cn(
                    'h-7 rounded-md border border-foreground bg-background px-2 text-[13px] font-medium text-foreground outline-none ring-3 ring-foreground/10',
                    busy && 'opacity-70'
                )}
            />
        </span>
    );
}
