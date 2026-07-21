import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    RadioGroup,
    RadioGroupItem,
    cn,
    toast,
    useAppearance,
    type ThemePreference
} from '@ortha-cms/design-system';
import { useUpdateTheme } from '../../../application/useUpdateTheme';
import { ThemePreview } from './ThemePreview';

/** Intl descriptors for {@link UserPreferencesPage}, co-located here. */
const messages = defineMessages({
    themeTitle: {
        id: 'users.preferences.themeTitle',
        defaultMessage: 'Theme'
    },
    themeDescription: {
        id: 'users.preferences.themeDescription',
        defaultMessage:
            'Choose how Ortha looks. This is personal to your account and applies immediately on every device you sign in on. “System” follows your device’s appearance setting.'
    },
    lightLabel: { id: 'users.preferences.lightLabel', defaultMessage: 'Light' },
    lightHint: {
        id: 'users.preferences.lightHint',
        defaultMessage: 'The bright, default canvas.'
    },
    darkLabel: { id: 'users.preferences.darkLabel', defaultMessage: 'Dark' },
    darkHint: {
        id: 'users.preferences.darkHint',
        defaultMessage: 'Dimmed surfaces, easier at night.'
    },
    systemLabel: {
        id: 'users.preferences.systemLabel',
        defaultMessage: 'System'
    },
    systemHint: {
        id: 'users.preferences.systemHint',
        defaultMessage: 'Match my device automatically.'
    },
    systemResolved: {
        id: 'users.preferences.systemResolved',
        defaultMessage: 'Your device is currently set to {mode}.'
    },
    modeLight: { id: 'users.preferences.modeLight', defaultMessage: 'light' },
    modeDark: { id: 'users.preferences.modeDark', defaultMessage: 'dark' },
    groupLabel: {
        id: 'users.preferences.groupLabel',
        defaultMessage: 'Colour theme'
    },
    saved: { id: 'users.preferences.saved', defaultMessage: 'Theme saved.' },
    failed: {
        id: 'users.preferences.failed',
        defaultMessage: 'Couldn’t save your theme. Please try again.'
    }
});

/** One selectable theme, its icon, and its co-located label/hint descriptors. */
type ThemeOption = {
    value: ThemePreference;
    icon: typeof Sun;
    label: MessageDescriptor;
    hint: MessageDescriptor;
    preview: 'light' | 'dark' | 'system';
};

const OPTIONS: ThemeOption[] = [
    {
        value: 'light',
        icon: Sun,
        label: messages.lightLabel,
        hint: messages.lightHint,
        preview: 'light'
    },
    {
        value: 'dark',
        icon: Moon,
        label: messages.darkLabel,
        hint: messages.darkHint,
        preview: 'dark'
    },
    {
        value: 'system',
        icon: Monitor,
        label: messages.systemLabel,
        hint: messages.systemHint,
        preview: 'system'
    }
];

/**
 * The Preferences tab (shown only on your **own** profile): pick the colour
 * theme (Light / Dark / System). Selection is optimistic — the app re-themes
 * the instant you choose, via the shared {@link useAppearance} provider — then
 * persisted to the server; a failed save rolls the choice back and surfaces a
 * toast. The radio group is the accessible backbone; each option is a full card
 * with a live preview.
 */
export function UserPreferencesPage() {
    const intl = useIntl();
    const { theme, resolvedTheme, setTheme } = useAppearance();
    const update = useUpdateTheme();

    const select = (next: ThemePreference) => {
        if (next === theme) {
            return;
        }
        const previous = theme;
        // Apply immediately so the whole UI re-themes as the user chooses…
        setTheme(next);
        // …then persist. On failure, roll the visible choice back.
        update.mutate(next, {
            onSuccess: () => toast.success(intl.formatMessage(messages.saved)),
            onError: () => {
                setTheme(previous);
                toast.error(intl.formatMessage(messages.failed));
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.themeTitle)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.themeDescription)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RadioGroup
                    value={theme}
                    onValueChange={(value) => select(value as ThemePreference)}
                    aria-label={intl.formatMessage(messages.groupLabel)}
                    className="grid gap-3 sm:grid-cols-3"
                >
                    {OPTIONS.map((option) => {
                        const selected = option.value === theme;
                        const Icon = option.icon;
                        const inputId = `theme-${option.value}`;
                        return (
                            <label
                                key={option.value}
                                htmlFor={inputId}
                                className={cn(
                                    'group relative flex cursor-pointer flex-col gap-3 rounded-lg border bg-card p-3 text-left transition-colors',
                                    'hover:border-input focus-within:ring-2 focus-within:ring-ring',
                                    selected
                                        ? 'border-primary ring-1 ring-primary'
                                        : 'border-border'
                                )}
                            >
                                <ThemePreview variant={option.preview} />
                                <div className="flex items-start gap-2">
                                    <Icon
                                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">
                                            {intl.formatMessage(option.label)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {intl.formatMessage(option.hint)}
                                        </p>
                                    </div>
                                    <RadioGroupItem
                                        id={inputId}
                                        value={option.value}
                                        className="sr-only"
                                    />
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                                            selected
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-input'
                                        )}
                                    >
                                        {selected ? (
                                            <Check className="size-3" />
                                        ) : null}
                                    </span>
                                </div>
                            </label>
                        );
                    })}
                </RadioGroup>
                {theme === 'system' ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.systemResolved, {
                            mode: intl.formatMessage(
                                resolvedTheme === 'dark'
                                    ? messages.modeDark
                                    : messages.modeLight
                            )
                        })}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
