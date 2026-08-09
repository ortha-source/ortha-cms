import { useState, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowUp, Square } from 'lucide-react';
import { Button, Textarea } from '@ortha-cms/design-system';

const messages = defineMessages({
    placeholder: {
        id: 'copilot.composer.placeholder',
        defaultMessage: 'Ask about your content…'
    },
    send: {
        id: 'copilot.composer.send',
        defaultMessage: 'Send'
    },
    stop: {
        id: 'copilot.composer.stop',
        defaultMessage: 'Stop'
    },
    hint: {
        id: 'copilot.composer.hint',
        defaultMessage: 'Enter to send, Shift+Enter for a new line'
    }
});

export interface ComposerProps {
    /** True while a run is in flight — the button becomes Stop. */
    busy: boolean;
    /** Sends the typed message. */
    onSend(text: string): void;
    /** Cancels the run in flight. */
    onStop(): void;
    /**
     * The textarea, so the panel can focus it on open. A ref rather than
     * `autoFocus`: the panel is **non-modal**, and `autoFocus` would also steal
     * focus on any remount (a resize, a workspace switch) while someone is
     * typing somewhere else on the page.
     */
    inputRef?: React.Ref<HTMLTextAreaElement>;
}

/**
 * The message box.
 *
 * Enter sends and Shift+Enter inserts a newline, which is the convention every
 * chat surface uses. IME composition is checked explicitly: mid-composition
 * Enter commits a candidate rather than meaning "send", and without the guard
 * anyone typing Japanese, Chinese or Korean would send a half-finished word.
 */
export function Composer({ busy, onSend, onStop, inputRef }: ComposerProps) {
    const intl = useIntl();
    const [value, setValue] = useState('');

    const submit = () => {
        const text = value.trim();
        if (!text || busy) {
            return;
        }
        onSend(text);
        setValue('');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey) {
            return;
        }
        if (event.nativeEvent.isComposing) {
            return;
        }
        event.preventDefault();
        submit();
    };

    return (
        <div className="border-border/60 border-t p-3">
            <div className="relative">
                <Textarea
                    ref={inputRef}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={intl.formatMessage(messages.placeholder)}
                    aria-label={intl.formatMessage(messages.placeholder)}
                    rows={2}
                    className="max-h-40 resize-none pr-11"
                />
                <Button
                    type="button"
                    size="icon"
                    className="absolute right-2 bottom-2 size-7"
                    onClick={busy ? onStop : submit}
                    disabled={!busy && value.trim().length === 0}
                    aria-label={intl.formatMessage(
                        busy ? messages.stop : messages.send
                    )}
                >
                    {busy ? (
                        <Square className="size-3.5" />
                    ) : (
                        <ArrowUp className="size-4" />
                    )}
                </Button>
            </div>
            <p className="text-muted-foreground mt-1.5 text-[11px]">
                {intl.formatMessage(messages.hint)}
            </p>
        </div>
    );
}
