import { defineMessages, useIntl } from 'react-intl';
import { RefreshCw, Send } from 'lucide-react';
import { Button, Spinner, cn } from '@orthacms/design-system';
import { PICK_PRESET, type PickPreset } from '../../../domain/publishPicks';

const messages = defineMessages({
    presets: { id: 'publishing.bar.presets', defaultMessage: 'Quick picks' },
    everything: {
        id: 'publishing.bar.everything',
        defaultMessage: 'Everything'
    },
    selected: {
        id: 'publishing.bar.selected',
        defaultMessage: 'Selected only'
    },
    none: { id: 'publishing.bar.none', defaultMessage: 'Clear' },
    picked: {
        id: 'publishing.bar.picked',
        defaultMessage:
            '{count, plural, =0 {Nothing picked yet.} one {# entry picked.} other {# entries picked.}}'
    },
    checkedSummary: {
        id: 'publishing.bar.checkedSummary',
        defaultMessage:
            '{ready, plural, =0 {None of the # picked can publish.} one {# of {count} ready to publish.} other {# of {count} ready to publish.}}'
    },
    check: {
        id: 'publishing.bar.check',
        defaultMessage: 'Check {count, plural, one {# entry} other {# entries}}'
    },
    recheck: { id: 'publishing.bar.recheck', defaultMessage: 'Re-check' },
    publish: {
        id: 'publishing.bar.publish',
        defaultMessage:
            'Publish {count, plural, one {# entry} other {# entries}}'
    },
    checkFailed: {
        id: 'publishing.bar.checkFailed',
        defaultMessage: 'Couldn’t check these entries. Please try again.'
    }
});

/**
 * The manager's controls: the quick picks, a running count, and the two steps
 * — **Check** (content's dry run over every picked entry, per type) and then
 * **Publish** (only what the check found ready). Publishing is never offered
 * before a check, and any change to the picks takes the page back to "Check",
 * so what goes out is always what was just checked.
 */
export function PublishActionBar({
    pickedCount,
    readyCount,
    checked,
    isChecking,
    isCommitting,
    checkFailed,
    busy,
    onPreset,
    onCheck,
    onPublish
}: {
    pickedCount: number;
    /** Ready after the last check — meaningful only when `checked`. */
    readyCount: number;
    /** A check has answered for the current picks. */
    checked: boolean;
    isChecking: boolean;
    isCommitting: boolean;
    checkFailed: boolean;
    /** Something is still loading; hold the steps. */
    busy: boolean;
    onPreset: (preset: PickPreset) => void;
    onCheck: () => void;
    onPublish: () => void;
}) {
    const intl = useIntl();
    const working = isChecking || isCommitting;
    return (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background py-3">
            <div
                role="group"
                aria-label={intl.formatMessage(messages.presets)}
                className="flex flex-wrap gap-2"
            >
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    disabled={working}
                    onClick={() => onPreset(PICK_PRESET.Everything)}
                >
                    {intl.formatMessage(messages.everything)}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    disabled={working}
                    onClick={() => onPreset(PICK_PRESET.Selected)}
                >
                    {intl.formatMessage(messages.selected)}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={working}
                    onClick={() => onPreset(PICK_PRESET.None)}
                >
                    {intl.formatMessage(messages.none)}
                </Button>
            </div>

            {/* Announced, so a screen-reader user hears what each toggle did
                to the total and why a step is disabled. */}
            <p
                role="status"
                className={cn(
                    'ml-auto text-sm',
                    checkFailed ? 'text-destructive' : 'text-muted-foreground'
                )}
            >
                {checkFailed
                    ? intl.formatMessage(messages.checkFailed)
                    : checked
                      ? intl.formatMessage(messages.checkedSummary, {
                            ready: readyCount,
                            count: pickedCount
                        })
                      : intl.formatMessage(messages.picked, {
                            count: pickedCount
                        })}
            </p>

            {checked ? (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        className="shadow-none"
                        disabled={working || busy}
                        onClick={onCheck}
                    >
                        <RefreshCw
                            className={cn('size-4', isChecking && 'ds-spinner')}
                            aria-hidden
                        />
                        {intl.formatMessage(messages.recheck)}
                    </Button>
                    <Button
                        type="button"
                        disabled={working || busy || readyCount === 0}
                        onClick={onPublish}
                    >
                        {isCommitting ? (
                            <Spinner aria-hidden />
                        ) : (
                            <Send className="size-4" aria-hidden />
                        )}
                        {intl.formatMessage(messages.publish, {
                            count: readyCount
                        })}
                    </Button>
                </>
            ) : (
                <Button
                    type="button"
                    disabled={working || busy || pickedCount === 0}
                    onClick={onCheck}
                >
                    {isChecking ? <Spinner aria-hidden /> : null}
                    {intl.formatMessage(messages.check, {
                        count: pickedCount
                    })}
                </Button>
            )}
        </div>
    );
}
