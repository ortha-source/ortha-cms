import { defineMessages, useIntl } from 'react-intl';
import { RefreshCw, Send } from 'lucide-react';
import { Button, Spinner, cn } from '@orthacms/design-system';
import type { Picks } from '../../../domain/publishPicks';
import type { PublishAxis, PublishRecord } from '../../../domain/types';
import { LocaleChips } from './LocaleChips';

const messages = defineMessages({
    checking: {
        id: 'publishing.bar.checking',
        defaultMessage: 'Checking…'
    },
    summary: {
        id: 'publishing.bar.summary',
        defaultMessage:
            '{picked, plural, =0 {Nothing picked} other {# of {options} picked}}{attention, plural, =0 {} one { · # needs attention} other { · # need attention}}'
    },
    checkFailed: {
        id: 'publishing.bar.checkFailed',
        defaultMessage: 'Couldn’t check these entries.'
    },
    recheck: { id: 'publishing.bar.recheck', defaultMessage: 'Re-check' },
    publish: {
        id: 'publishing.bar.publish',
        defaultMessage:
            'Publish {count, plural, one {# entry} other {# entries}}'
    }
});

/**
 * The one bar of controls: the locale chips on the left, the count and the
 * two actions on the right — **Re-check** (an icon: the check runs by itself,
 * this is the "ask again") and **Publish**. Sticky, so the button is in reach
 * at the bottom of a long list.
 */
export function PublishToolbar({
    axes,
    records,
    picks,
    pickedCount,
    optionCount,
    attentionCount,
    publishCount,
    isChecking,
    isCommitting,
    checkFailed,
    busy,
    onToggleAxis,
    onRecheck,
    onPublish
}: {
    axes: readonly PublishAxis[];
    records: readonly PublishRecord[];
    picks: Picks;
    pickedCount: number;
    optionCount: number;
    attentionCount: number;
    /** Picked and found ready — what Publish will send. */
    publishCount: number;
    isChecking: boolean;
    isCommitting: boolean;
    checkFailed: boolean;
    busy: boolean;
    onToggleAxis: (axis: string, on: boolean) => void;
    onRecheck: () => void;
    onPublish: () => void;
}) {
    const intl = useIntl();
    const working = isChecking || isCommitting;
    return (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background py-3">
            <LocaleChips
                axes={axes}
                records={records}
                picks={picks}
                disabled={working}
                onToggle={onToggleAxis}
            />
            {/* Announced: what each toggle did, and why Publish is disabled. */}
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
                            options: optionCount,
                            attention: attentionCount
                        })}
            </p>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={intl.formatMessage(messages.recheck)}
                title={intl.formatMessage(messages.recheck)}
                disabled={working || busy}
                onClick={onRecheck}
            >
                <RefreshCw
                    className={cn('size-4', isChecking && 'ds-spinner')}
                    aria-hidden
                />
            </Button>
            <Button
                type="button"
                disabled={working || busy || publishCount === 0}
                onClick={onPublish}
            >
                {isCommitting ? (
                    <Spinner aria-hidden />
                ) : (
                    <Send className="size-4" aria-hidden />
                )}
                {intl.formatMessage(messages.publish, { count: publishCount })}
            </Button>
        </div>
    );
}
