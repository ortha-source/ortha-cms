import {
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowUp, Square } from 'lucide-react';
import { Button, Textarea, cn } from '@ortha-cms/design-system';

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

/**
 * How tall the box may grow before it scrolls, in px — about six lines.
 *
 * A composer that grows without a ceiling eats the transcript it is a reply to;
 * one that never grows hides the paragraph you are still editing behind two
 * visible lines. Six is enough to see a long question whole and little enough
 * that the answer above stays on screen.
 */
const MAX_HEIGHT = 152;

export interface ComposerProps {
    /** True while a run is in flight — the button becomes Stop. */
    busy: boolean;
    /** Sends the typed message. */
    onSend(text: string): void;
    /** Cancels the run in flight. */
    onStop(): void;
    /**
     * The textarea, so a surface can focus it on open. A ref rather than
     * `autoFocus`: the panel is **non-modal**, and `autoFocus` would also steal
     * focus on any remount (a resize, a workspace switch) while someone is
     * typing somewhere else on the page.
     */
    inputRef?: React.Ref<HTMLTextAreaElement>;
    /**
     * Controls for the box's bottom-left — the model picker, and whatever else
     * belongs to composing the *next* turn rather than to the thread. They sit
     * inside the box because that is what they act on; putting them in a page
     * header states them as a property of the conversation, which the model
     * choice is not (it applies per turn).
     */
    controls?: ReactNode;
    /**
     * Overrides the wrapper's chrome. The panel wants the divider and padding
     * that separate it from the transcript above; a page that already centres
     * its own column wants neither.
     */
    className?: string;
}

/**
 * The message box: a bordered field with the send button and any per-turn
 * controls on a row along its bottom.
 *
 * Enter sends and Shift+Enter inserts a newline, which is the convention every
 * chat surface uses. IME composition is checked explicitly: mid-composition
 * Enter commits a candidate rather than meaning "send", and without the guard
 * anyone typing Japanese, Chinese or Korean would send a half-finished word.
 *
 * **The field grows with what you type, up to {@link MAX_HEIGHT}.** A fixed two
 * rows is fine for "how many authors are there?" and wrong for the paragraph of
 * context that makes a question answerable — you end up editing through a
 * letterbox. Growth is measured rather than counted (`scrollHeight` after
 * collapsing to `auto`), so a wrapped line costs the same as a typed newline.
 */
export function Composer({
    busy,
    onSend,
    onStop,
    inputRef,
    controls,
    className
}: ComposerProps) {
    const intl = useIntl();
    const [value, setValue] = useState('');
    const fieldRef = useRef<HTMLTextAreaElement | null>(null);

    // The caller may want the field too (the page focuses it on mount), and an
    // element has one `ref` — so this fans the node out to both.
    const attachField = useCallback(
        (node: HTMLTextAreaElement | null) => {
            fieldRef.current = node;
            if (typeof inputRef === 'function') {
                inputRef(node);
            } else if (inputRef) {
                (
                    inputRef as React.MutableRefObject<HTMLTextAreaElement | null>
                ).current = node;
            }
        },
        [inputRef]
    );

    // Before paint, not after: measuring in `useEffect` lets the browser show
    // one frame at the old height, which reads as a flicker on every keystroke
    // that wraps a line. Collapsing to `auto` first is what lets it *shrink*
    // again when text is deleted — `scrollHeight` never reports less than the
    // height already set.
    useLayoutEffect(() => {
        const field = fieldRef.current;
        if (!field) {
            return;
        }
        field.style.height = 'auto';
        field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
    }, [value]);

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
        <div className={cn('border-border/60 border-t p-3', className)}>
            {/* The border and the focus ring live on this wrapper rather than on
                the field, so the controls below read as part of one box. The
                field itself is stripped of both — two nested rings on focus is
                the giveaway that a composer was assembled rather than designed. */}
            <div className="border-input bg-card focus-within:border-primary focus-within:ring-primary/15 rounded-lg border shadow-xs transition-colors focus-within:ring-2">
                <Textarea
                    ref={attachField}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={intl.formatMessage(messages.placeholder)}
                    aria-label={intl.formatMessage(messages.placeholder)}
                    rows={2}
                    className="min-h-0 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    {/* Always rendered, even with no controls, so the send
                        button keeps its place instead of jumping when a
                        deployment offers one model and the picker hides. */}
                    <div className="flex min-w-0 items-center gap-1">
                        {controls}
                    </div>
                    <Button
                        type="button"
                        size="icon"
                        className="size-7 shrink-0"
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
            </div>
            <p className="text-muted-foreground mt-1.5 text-[11px]">
                {intl.formatMessage(messages.hint)}
            </p>
        </div>
    );
}
