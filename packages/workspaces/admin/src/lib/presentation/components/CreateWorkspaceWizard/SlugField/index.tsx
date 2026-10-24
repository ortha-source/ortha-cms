import { defineMessages, useIntl } from 'react-intl';
import { AlertCircle, Check, RotateCcw, X } from 'lucide-react';
import {
    Badge,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    Spinner
} from '@orthacms/design-system';
import { SlugStatus } from '../../../../domain/types/wizard';

const messages = defineMessages({
    label: {
        id: 'workspaces.create.basics.addressLabel',
        defaultMessage: 'Address'
    },
    prefix: {
        id: 'workspaces.create.basics.addressPrefix',
        defaultMessage: '/workspaces/'
    },
    placeholder: {
        id: 'workspaces.create.basics.slugPlaceholder',
        defaultMessage: 'marketing-site'
    },
    help: {
        id: 'workspaces.create.basics.addressHelp',
        defaultMessage:
            'Made from the name. It can’t change after the workspace is created.'
    },
    regenerate: {
        id: 'workspaces.create.basics.slugRegenerate',
        defaultMessage: 'Make it from the name again'
    },
    checking: {
        id: 'workspaces.create.basics.slugChecking',
        defaultMessage: 'Checking…'
    },
    available: {
        id: 'workspaces.create.basics.slugAvailable',
        defaultMessage: 'Available'
    },
    takenBadge: {
        id: 'workspaces.create.basics.slugTakenBadge',
        defaultMessage: 'Taken'
    },
    taken: {
        id: 'workspaces.create.basics.slugTaken',
        defaultMessage:
            'Another workspace already has this address. Try a different one.'
    },
    unknown: {
        id: 'workspaces.create.basics.slugUnknown',
        defaultMessage:
            'Couldn’t check whether this address is free, so you can’t continue yet. Please try again.'
    }
});

/** The availability badge inside the address input. */
function AvailabilityBadge({ status }: { status: SlugStatus }) {
    const intl = useIntl();
    if (status === SlugStatus.Checking) {
        return (
            <Badge variant="secondary" size="xs">
                <Spinner className="size-3" />
                {intl.formatMessage(messages.checking)}
            </Badge>
        );
    }
    if (status === SlugStatus.Available) {
        return (
            <Badge variant="success" size="xs">
                <Check aria-hidden />
                {intl.formatMessage(messages.available)}
            </Badge>
        );
    }
    if (status === SlugStatus.Taken) {
        return (
            <Badge variant="destructive" size="xs">
                <X aria-hidden />
                {intl.formatMessage(messages.takenBadge)}
            </Badge>
        );
    }
    return null;
}

/** Props for {@link SlugField}. */
export type SlugFieldProps = {
    /** Current slug value. */
    value: string;
    /** Whether the user has manually edited the slug. */
    slugEdited: boolean;
    /** Live availability status. */
    status: SlugStatus;
    /** Called when the slug input changes. */
    onChange: (value: string) => void;
    /** Called when the regenerate button is pressed. */
    onRegenerate: () => void;
    /** Localized shape error (e.g. pattern violation). */
    error?: string;
};

/**
 * The slug, shown as the address it becomes — `/workspaces/<slug>` — with its
 * availability checked as you type and said inline, inside the field. A slug
 * edited by hand gets a button to make it from the name again. Shape errors,
 * a taken address and a check that could not run each say so under the field.
 */
export function SlugField({
    value,
    slugEdited,
    status,
    onChange,
    onRegenerate,
    error
}: SlugFieldProps) {
    const intl = useIntl();
    const problem =
        error ??
        (status === SlugStatus.Taken
            ? intl.formatMessage(messages.taken)
            : undefined);

    return (
        <Field data-invalid={!!problem}>
            <FieldLabel htmlFor="workspace-slug">
                {intl.formatMessage(messages.label)}
            </FieldLabel>
            <InputGroup className="font-mono shadow-none">
                <InputGroupAddon className="pr-0 font-mono text-muted-foreground">
                    {intl.formatMessage(messages.prefix)}
                </InputGroupAddon>
                <InputGroupInput
                    id="workspace-slug"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={intl.formatMessage(messages.placeholder)}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={!!problem}
                    className="pl-0.5 font-mono"
                />
                <InputGroupAddon align="inline-end" className="gap-1">
                    <AvailabilityBadge status={status} />
                    {slugEdited ? (
                        <InputGroupButton
                            size="icon-xs"
                            onClick={onRegenerate}
                            title={intl.formatMessage(messages.regenerate)}
                            aria-label={intl.formatMessage(messages.regenerate)}
                        >
                            <RotateCcw />
                        </InputGroupButton>
                    ) : null}
                </InputGroupAddon>
            </InputGroup>
            {problem ? (
                <FieldError errors={[{ message: problem }]} />
            ) : status === SlugStatus.Unknown ? (
                // `role="alert"`: a failure the user didn't cause and must act
                // on. The other states are passive and would be noise.
                <p
                    role="alert"
                    className="flex items-center gap-1.5 text-sm text-destructive"
                >
                    <AlertCircle className="size-3.5" aria-hidden />
                    {intl.formatMessage(messages.unknown)}
                </p>
            ) : (
                <FieldDescription>
                    {intl.formatMessage(messages.help)}
                </FieldDescription>
            )}
        </Field>
    );
}
