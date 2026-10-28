import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    SegmentedControl,
    SegmentedControlItem,
    Skeleton,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    useDigestSettings,
    useSaveDigestSettings
} from '../../../application/useDigestSettings';
import type { DigestFrequency } from '../../../types/alarm';

const messages = defineMessages({
    title: { id: 'alarms.digest.title', defaultMessage: 'Alarm digest' },
    description: {
        id: 'alarms.digest.description',
        defaultMessage:
            'One email listing the warnings and errors your alarms opened, across every workspace you belong to. Nothing is sent for a quiet period.'
    },
    daily: { id: 'alarms.digest.daily', defaultMessage: 'Daily' },
    weekly: { id: 'alarms.digest.weekly', defaultMessage: 'Weekly' },
    off: { id: 'alarms.digest.off', defaultMessage: 'Off' },
    unavailable: {
        id: 'alarms.digest.unavailable',
        defaultMessage:
            'This installation has no mail configured, so no digest is sent. Your inbox still lists every alarm you own.'
    },
    loadError: {
        id: 'alarms.digest.loadError',
        defaultMessage: 'Could not load your digest setting.'
    },
    saved: {
        id: 'alarms.digest.saved',
        defaultMessage:
            '{frequency, select, daily {You will get the alarm digest daily.} weekly {You will get the alarm digest weekly, on Mondays.} other {The alarm digest is off.}}'
    },
    saveError: {
        id: 'alarms.digest.saveError',
        defaultMessage: 'Could not save your digest setting.'
    }
});

const FREQUENCIES: readonly DigestFrequency[] = ['daily', 'weekly', 'off'];

/**
 * The alarm digest's frequency, on the reader's notification settings
 * (`INBOX_SETTINGS_SLOT`). Rendered only for someone who can read alarms —
 * the digest lists nothing for anybody else.
 *
 * With no mail provider the control stays visible but disabled, with the
 * reason beside it: a setting that silently does nothing is worse than one
 * that says why.
 */
export function AlarmDigestSettings() {
    const canRead = useHasPermission('alarms:read');
    const intl = useIntl();
    const headingId = useId();
    const settings = useDigestSettings(canRead);
    const save = useSaveDigestSettings();

    if (!canRead) return null;

    const onChange = (next: string) => {
        // Clicking the selected segment again deselects it in Radix; a
        // frequency is never blank, so that click is ignored.
        if (!next || next === settings.data?.frequency) return;
        save.mutate(next as DigestFrequency, {
            onSuccess: ({ frequency }) =>
                toast.success(
                    intl.formatMessage(messages.saved, { frequency })
                ),
            onError: () => toast.error(intl.formatMessage(messages.saveError))
        });
    };

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 id={headingId} className="text-base font-semibold">
                    {intl.formatMessage(messages.title)}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.description)}
                </p>
            </div>
            {settings.isPending ? (
                <Skeleton className="h-9 w-56" />
            ) : settings.isError ? (
                <p role="alert" className="text-sm text-destructive">
                    {intl.formatMessage(messages.loadError)}
                </p>
            ) : (
                <>
                    <SegmentedControl
                        variant="muted"
                        className="self-start"
                        aria-labelledby={headingId}
                        value={settings.data.frequency}
                        disabled={!settings.data.available || save.isPending}
                        onValueChange={onChange}
                    >
                        {FREQUENCIES.map((frequency) => (
                            <SegmentedControlItem
                                key={frequency}
                                value={frequency}
                            >
                                {intl.formatMessage(messages[frequency])}
                            </SegmentedControlItem>
                        ))}
                    </SegmentedControl>
                    {settings.data.available ? null : (
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.unavailable)}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
