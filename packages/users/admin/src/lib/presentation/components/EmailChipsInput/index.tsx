import {
    useRef,
    useState,
    type ClipboardEvent,
    type KeyboardEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import { Email } from '../../../domain/value-objects/email';

/** Intl descriptors for {@link EmailChipsInput}, co-located. */
const messages = defineMessages({
    placeholder: {
        id: 'users.inviteSheet.emailsPlaceholder',
        defaultMessage: 'Paste or type, comma-separated'
    },
    remove: {
        id: 'users.inviteSheet.removeEmail',
        defaultMessage: 'Remove {email}'
    },
    list: {
        id: 'users.inviteSheet.emailList',
        defaultMessage: 'Addresses to invite'
    }
});

/** Keys that turn what has been typed into a chip. */
const COMMIT_KEYS = new Set(['Enter', ',', ';', ' ', 'Tab']);

/**
 * An address field that turns what is typed or pasted into chips — one per
 * address, so several people can be invited at once. A comma, semicolon,
 * space, Enter or Tab commits what has been typed; a paste is split whole
 * (a spreadsheet column arrives one per line); Backspace in an empty box
 * removes the last chip, and each chip has its own labelled remove button.
 *
 * A chip the caller marks `flagged` (malformed, or already a member) is drawn
 * as an error, but kept: the person sees exactly which address is wrong and
 * removes or fixes it — the field never silently drops something they typed.
 */
export function EmailChipsInput({
    id,
    emails,
    flagged,
    describedBy,
    invalid = false,
    disabled = false,
    onChange
}: {
    /** The text input's id, for the field's `<label htmlFor>`. */
    id: string;
    /** The committed addresses, in order. */
    emails: string[];
    /** Addresses to draw as errors. */
    flagged: ReadonlySet<string>;
    /** Ids of the hint/error text describing the field. */
    describedBy?: string;
    /** Whether the field as a whole is in error (`aria-invalid`). */
    invalid?: boolean;
    /** Disables typing and removal (while sending). */
    disabled?: boolean;
    /** Called with the next list of addresses. */
    onChange: (emails: string[]) => void;
}) {
    const intl = useIntl();
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    /** Adds the addresses in `text` after the existing ones, keeping order. */
    const commit = (text: string) => {
        const added = Email.splitList(text).filter(
            (email) => !emails.includes(email)
        );
        if (added.length > 0) {
            onChange([...emails, ...added]);
        }
        setDraft('');
    };

    const remove = (email: string) => {
        onChange(emails.filter((item) => item !== email));
        inputRef.current?.focus();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (COMMIT_KEYS.has(event.key)) {
            // Tab with nothing typed is ordinary navigation, not a commit.
            if (event.key === 'Tab' && draft.trim() === '') {
                return;
            }
            event.preventDefault();
            commit(draft);
            return;
        }
        if (event.key === 'Backspace' && draft === '' && emails.length > 0) {
            event.preventDefault();
            onChange(emails.slice(0, -1));
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const text = event.clipboardData.getData('text');
        if (/[\s,;]/.test(text.trim())) {
            event.preventDefault();
            commit(`${draft} ${text}`);
        }
    };

    return (
        <div
            // A click anywhere in the box lands in the text input, as it would
            // in a plain input of the same size.
            onClick={() => inputRef.current?.focus()}
            className={cn(
                'flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-1.5 py-1.5 text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
                invalid &&
                    'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
                disabled && 'cursor-not-allowed opacity-60'
            )}
        >
            {emails.length > 0 ? (
                <ul
                    aria-label={intl.formatMessage(messages.list)}
                    className="contents"
                >
                    {emails.map((email) => {
                        const bad = flagged.has(email);
                        return (
                            <li
                                key={email}
                                data-flagged={bad || undefined}
                                className={cn(
                                    'inline-flex h-6 max-w-full items-center gap-1 rounded-md pl-2 pr-1 text-[13px]',
                                    bad
                                        ? 'bg-destructive-soft text-destructive-soft-foreground'
                                        : 'bg-muted text-foreground'
                                )}
                            >
                                <span className="truncate">{email}</span>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    aria-label={intl.formatMessage(
                                        messages.remove,
                                        { email }
                                    )}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        remove(email);
                                    }}
                                    className="flex size-4 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <X aria-hidden className="size-3" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            <input
                ref={inputRef}
                id={id}
                type="text"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                disabled={disabled}
                placeholder={intl.formatMessage(messages.placeholder)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => {
                    const value = event.target.value;
                    // Typing a separator commits in onKeyDown; this catches
                    // the ones that arrive without a key (autofill, IME).
                    if (/[,;\n]/.test(value)) {
                        commit(value);
                        return;
                    }
                    setDraft(value);
                }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => {
                    if (draft.trim()) {
                        commit(draft);
                    }
                }}
                className="h-6 min-w-[12ch] flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
            />
        </div>
    );
}
