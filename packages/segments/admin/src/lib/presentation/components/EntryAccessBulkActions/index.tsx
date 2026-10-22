import { defineMessages, useIntl } from 'react-intl';
import { Check, Ban, ChevronDown, Eraser } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@orthacms/design-system';
import { SEGMENT_STATE, type SegmentState } from '../../../domain/types';

const messages = defineMessages({
    trigger: { id: 'segments.bulk.trigger', defaultMessage: 'Set all…' },
    allow: { id: 'segments.bulk.allow', defaultMessage: 'All can see' },
    deny: { id: 'segments.bulk.deny', defaultMessage: 'None can see' },
    clear: { id: 'segments.bulk.clear', defaultMessage: 'Clear all' },
    scopeAll: {
        id: 'segments.bulk.scopeAll',
        defaultMessage:
            'Applies to all {count} audiences, not just the ones on this page.'
    },
    scopeSearch: {
        id: 'segments.bulk.scopeSearch',
        defaultMessage:
            'Applies to the {count} audiences matching your search, not just the ones on this page.'
    },
    truncated: {
        id: 'segments.bulk.truncated',
        defaultMessage:
            'There are more audiences than an entry can name at once, so setting them all is unavailable. Narrow the list with the search first.'
    }
});

/**
 * The Access tab's **Set all…** menu: every audience to Can see, to Cannot
 * see, or back to unset.
 *
 * **Every audience means every one the filter matched, not this page's.** The
 * ids come from the list response rather than the rows on screen, because a
 * control called "set every audience" that quietly set ten of forty would be
 * worse than no control: the mistake is invisible until a reader is turned away.
 *
 * When more matched than an entry may name on one side, the controls are
 * disabled with the reason rather than doing part of the job — that many could
 * not be stored anyway, so offering it would be offering a save that 400s.
 *
 * **Clear all** is here beside the other two because "start again" is the way
 * out of a bulk action somebody applied by accident, and it is the one thing
 * that cannot be reached by setting rows one at a time in fewer moves.
 */
export function EntryAccessBulkActions({
    count,
    searching,
    truncated,
    disabled,
    onApply
}: {
    /** How many audiences the current filter matched. */
    count: number;
    /** Whether a search is narrowing that set — it changes what "every" means. */
    searching: boolean;
    /** Whether the matched set is larger than an entry can name. */
    truncated: boolean;
    disabled?: boolean;
    /** Apply one state to every matched audience. */
    onApply: (state: SegmentState) => void;
}) {
    const intl = useIntl();
    const locked = disabled || truncated || count === 0;
    const scope = truncated
        ? intl.formatMessage(messages.truncated)
        : intl.formatMessage(
              searching ? messages.scopeSearch : messages.scopeAll,
              { count }
          );

    // One menu rather than a row of three buttons: setting every audience at
    // once is the occasional move, and the row sat between the search and the
    // list as loudly as the per-audience controls it overrides. Non-modal, like
    // every menu in this admin.
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                >
                    {intl.formatMessage(messages.trigger)}
                    <ChevronDown aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {scope}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={locked}
                    onSelect={() => onApply(SEGMENT_STATE.Allow)}
                >
                    <Check aria-hidden />
                    {intl.formatMessage(messages.allow)}
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={locked}
                    onSelect={() => onApply(SEGMENT_STATE.Deny)}
                >
                    <Ban aria-hidden />
                    {intl.formatMessage(messages.deny)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={locked}
                    onSelect={() => onApply(SEGMENT_STATE.Unset)}
                >
                    <Eraser aria-hidden />
                    {intl.formatMessage(messages.clear)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
