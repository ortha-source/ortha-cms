import { defineMessages, useIntl } from 'react-intl';
import { Check, Cpu } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import {
    modelChoiceKey,
    useCopilotModels,
    type CopilotModelChoice
} from '../../application/useCopilotModels';

const messages = defineMessages({
    label: {
        id: 'copilot.model.label',
        defaultMessage: 'Model'
    },
    choose: {
        id: 'copilot.model.choose',
        defaultMessage: 'Choose a model'
    },
    default: {
        id: 'copilot.model.default',
        defaultMessage: 'Default'
    },
    none: {
        id: 'copilot.model.none',
        defaultMessage: 'No models configured'
    }
});

export interface ModelPickerProps {
    /** The current choice, or `null` to use the deployment default. */
    value: CopilotModelChoice | null;
    /** Called when the user picks a different backend. */
    onChange(choice: CopilotModelChoice | null): void;
}

/**
 * Picks which registered backend the next turn runs on.
 *
 * The choice is **per turn, not per thread** — sending a different model on the
 * next message is all it takes, which is what lets a conversation start on a
 * cheap model and escalate when the question gets hard. Phase 0 made this
 * possible by having a provider serve a *list* of models and by exposing
 * `catalogue()`; this is that decision paying off.
 *
 * Renders nothing when the deployment offers a single backend: a picker with
 * one option is noise. It also renders nothing while the catalogue is loading,
 * rather than a disabled control that shifts the header once it arrives.
 */
export function ModelPicker({ value, onChange }: ModelPickerProps) {
    const intl = useIntl();
    const { data } = useCopilotModels();
    const items = data?.items ?? [];

    if (items.length <= 1) {
        return null;
    }

    const current = value ? modelChoiceKey(value) : null;

    return (
        // `modal={false}`, like every other menu in the admin: a modal one
        // `aria-hidden`s the page root, which holds focusable content, and axe
        // fails it as `aria-hidden-focus`. It is doubly wrong here — the chat
        // surfaces this sits in are non-modal on purpose, and a picker for the
        // *next* turn has no business trapping the page behind it.
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-8 gap-1.5 px-2 text-xs"
                    aria-label={intl.formatMessage(messages.choose)}
                    title={intl.formatMessage(messages.choose)}
                >
                    <Cpu className="size-3.5" />
                    <span className="max-w-32 truncate">
                        {value?.model ?? intl.formatMessage(messages.default)}
                    </span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                    {intl.formatMessage(messages.label)}
                </DropdownMenuLabel>

                {/* "Default" is a real option, not the absence of one: it means
                    "whatever the host's resolver picks", which can differ per
                    run and per workspace. Pinning it to today's default would
                    silently opt the user out of that routing. */}
                <DropdownMenuItem onSelect={() => onChange(null)}>
                    <Check
                        className={
                            current === null ? 'size-3.5' : 'size-3.5 opacity-0'
                        }
                    />
                    {intl.formatMessage(messages.default)}
                </DropdownMenuItem>

                {items.map((choice) => {
                    const key = modelChoiceKey(choice);
                    return (
                        <DropdownMenuItem
                            key={key}
                            onSelect={() => onChange(choice)}
                        >
                            <Check
                                className={
                                    current === key
                                        ? 'size-3.5'
                                        : 'size-3.5 opacity-0'
                                }
                            />
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate text-sm">
                                    {choice.model}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
                                    {choice.provider}
                                </span>
                            </span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
