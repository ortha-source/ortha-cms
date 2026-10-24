import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import {
    Checkbox,
    FieldError,
    Label,
    RadioGroup,
    RadioGroupItem,
    Skeleton,
    cn
} from '@orthacms/design-system';

const messages = defineMessages({
    label: {
        id: 'segments.workspaces.label',
        defaultMessage: 'Offered in'
    },
    every: {
        id: 'segments.workspaces.every',
        defaultMessage: 'Every workspace'
    },
    everyHint: {
        id: 'segments.workspaces.everyHint',
        defaultMessage: 'Including new ones.'
    },
    some: {
        id: 'segments.workspaces.some',
        defaultMessage: 'Some workspaces'
    },
    someHint: {
        id: 'segments.workspaces.someHint',
        defaultMessage: 'Pick where editors can use it.'
    },
    pick: {
        id: 'segments.workspaces.pick',
        defaultMessage: 'Workspaces offering this audience'
    },
    narrowing: {
        id: 'segments.workspaces.narrowing',
        defaultMessage:
            'Narrowing this stops the audience being offered on new decisions. Entries that already name it keep it, and keep reading the way they do now.'
    },
    empty: {
        id: 'segments.workspaces.empty',
        defaultMessage:
            'No workspaces exist yet, so this is offered in all of them.'
    },
    error: {
        id: 'segments.workspaces.error',
        defaultMessage:
            'Couldn’t load the workspaces. This audience stays offered wherever it already is.'
    }
});

/** Every workspace (including ones created later), or a chosen few. */
export const OFFERED_IN = {
    Every: 'every',
    Some: 'some'
} as const;

/** One value of {@link OFFERED_IN}. */
export type OfferedIn = (typeof OFFERED_IN)[keyof typeof OFFERED_IN];

type OfferedInFieldProps = {
    mode: OfferedIn;
    onModeChange: (next: OfferedIn) => void;
    /** The ticked workspace ids — read only in `some` mode. */
    value: readonly string[];
    onChange: (next: string[]) => void;
    /** "Pick at least one", once it is due. */
    error?: string;
    disabled?: boolean;
};

/**
 * Where an audience is offered — **every workspace as a choice of its own**.
 *
 * Two option cards rather than a list of boxes whose all-clear state means
 * "every one": the server reads an empty `workspaceIds` as everywhere
 * (including workspaces created later), and a control that said so only in a
 * hint invited reading the empty state as "nowhere". The checkboxes appear
 * under **Some workspaces**, and picking that with nothing ticked is refused by
 * the form rather than quietly saved as "every" — the opposite of what the
 * person chose.
 *
 * The ticked set survives switching back to "Every" and out again, so a slip
 * of the radio does not lose a careful selection. Only the save decides what is
 * sent.
 *
 * A failed workspace read is **not** an empty one: it renders as a warning that
 * leaves the current scope alone, since a form that quietly showed no boxes
 * would invite saving an audience somebody believes is scoped.
 */
export function OfferedInField({
    mode,
    onModeChange,
    value,
    onChange,
    error,
    disabled
}: OfferedInFieldProps) {
    const intl = useIntl();
    const id = useId();
    const workspaces = useWorkspaces();
    const selected = new Set(value);
    const labelId = `${id}-label`;
    const errorId = `${id}-error`;

    const toggle = (workspaceId: string) => {
        const next = new Set(selected);
        if (next.has(workspaceId)) next.delete(workspaceId);
        else next.add(workspaceId);
        onChange([...next]);
    };

    const options: { value: OfferedIn; title: string; hint: string }[] = [
        {
            value: OFFERED_IN.Every,
            title: intl.formatMessage(messages.every),
            hint: intl.formatMessage(messages.everyHint)
        },
        {
            value: OFFERED_IN.Some,
            title: intl.formatMessage(messages.some),
            hint: intl.formatMessage(messages.someHint)
        }
    ];

    return (
        <div className="flex flex-col gap-2">
            <span id={labelId} className="text-sm font-medium leading-snug">
                {intl.formatMessage(messages.label)}
            </span>
            <RadioGroup
                aria-labelledby={labelId}
                value={mode}
                disabled={disabled}
                onValueChange={(next) => onModeChange(next as OfferedIn)}
                className="grid gap-2 sm:grid-cols-2"
            >
                {options.map((option) => (
                    <Label
                        key={option.value}
                        htmlFor={`${id}-${option.value}`}
                        className={cn(
                            'flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 font-normal transition-colors hover:bg-muted/40',
                            mode === option.value &&
                                'border-foreground ring-1 ring-foreground'
                        )}
                    >
                        <RadioGroupItem
                            id={`${id}-${option.value}`}
                            value={option.value}
                            className="mt-0.5"
                        />
                        <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">
                                {option.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {option.hint}
                            </span>
                        </span>
                    </Label>
                ))}
            </RadioGroup>

            {mode === OFFERED_IN.Some ? (
                <div className="flex flex-col gap-2">
                    {workspaces.isPending ? (
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : workspaces.isError ? (
                        <p
                            role="alert"
                            className="text-sm text-muted-foreground"
                        >
                            {intl.formatMessage(messages.error)}
                        </p>
                    ) : (workspaces.data ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.empty)}
                        </p>
                    ) : (
                        <ul
                            aria-label={intl.formatMessage(messages.pick)}
                            aria-describedby={error ? errorId : undefined}
                            className="divide-y overflow-hidden rounded-lg border"
                        >
                            {(workspaces.data ?? []).map((workspace) => (
                                <li key={workspace.id}>
                                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                                        <Checkbox
                                            checked={selected.has(workspace.id)}
                                            disabled={disabled}
                                            onCheckedChange={() =>
                                                toggle(workspace.id)
                                            }
                                        />
                                        <span className="min-w-0">
                                            <span className="font-medium">
                                                {workspace.name}
                                            </span>
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                /{workspace.slug}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    {error ? (
                        <FieldError id={errorId}>{error}</FieldError>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.narrowing)}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
