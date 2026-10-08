import { defineMessages, useIntl } from 'react-intl';
import { ChevronsDownUp, ChevronsUpDown, RefreshCw, Send } from 'lucide-react';
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
    expandAll: { id: 'publishing.bar.expandAll', defaultMessage: 'Expand all' },
    collapseAll: {
        id: 'publishing.bar.collapseAll',
        defaultMessage: 'Collapse all'
    },
    checking: {
        id: 'publishing.bar.checking',
        defaultMessage: 'Checking what can publish…'
    },
    summary: {
        id: 'publishing.bar.summary',
        defaultMessage:
            '{picked, plural, =0 {Nothing picked yet.} one {# picked · {ready} ready to publish} other {# picked · {ready} ready to publish}}{blocked, plural, =0 {} one { · # needs fixes} other { · # need fixes}}'
    },
    recheck: { id: 'publishing.bar.recheck', defaultMessage: 'Re-check' },
    publish: {
        id: 'publishing.bar.publish',
        defaultMessage:
            'Publish {count, plural, one {# entry} other {# entries}}'
    },
    checkFailed: {
        id: 'publishing.bar.checkFailed',
        defaultMessage: 'Couldn’t check these entries. Re-check to try again.'
    }
});

/**
 * The manager's controls, sticky over the cards: the quick picks, expanding
 * or folding every card, a running summary — picked, ready, needing fixes —
 * and the two actions. The check runs **by itself** whenever the set changes
 * (a verdict belongs to the entry, not to the pick), so there is no "check"
 * step to remember: **Re-check** asks again, **Publish** sends the picked
 * entries the last check found ready.
 */
export function PublishActionBar({
    pickedCount,
    readyCount,
    blockedCount,
    allOpen,
    isChecking,
    isCommitting,
    checkFailed,
    busy,
    onPreset,
    onToggleAll,
    onRecheck,
    onPublish
}: {
    pickedCount: number;
    /** Picked and found ready by the last check. */
    readyCount: number;
    /** Picked and blocked by the last check. */
    blockedCount: number;
    /** Every card is open. */
    allOpen: boolean;
    isChecking: boolean;
    isCommitting: boolean;
    checkFailed: boolean;
    /** Something is still loading; hold the actions. */
    busy: boolean;
    onPreset: (preset: PickPreset) => void;
    onToggleAll: (open: boolean) => void;
    onRecheck: () => void;
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
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleAll(!allOpen)}
            >
                {allOpen ? (
                    <ChevronsDownUp className="size-4" aria-hidden />
                ) : (
                    <ChevronsUpDown className="size-4" aria-hidden />
                )}
                {intl.formatMessage(
                    allOpen ? messages.collapseAll : messages.expandAll
                )}
            </Button>

            {/* Announced, so a screen-reader user hears what each toggle did
                to the totals and why Publish is disabled. */}
            <p
                role="status"
                className={cn(
                    'ml-auto text-sm',
                    checkFailed ? 'text-destructive' : 'text-muted-foreground'
                )}
            >
                {checkFailed
                    ? intl.formatMessage(messages.checkFailed)
                    : isChecking
                      ? intl.formatMessage(messages.checking)
                      : intl.formatMessage(messages.summary, {
                            picked: pickedCount,
                            ready: readyCount,
                            blocked: blockedCount
                        })}
            </p>

            <Button
                type="button"
                variant="outline"
                className="shadow-none"
                disabled={working || busy}
                onClick={onRecheck}
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
                {intl.formatMessage(messages.publish, { count: readyCount })}
            </Button>
        </div>
    );
}
