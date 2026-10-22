import {
    ENTRY_STATUS_ITEM_SLOT,
    type EntrySlotContext,
    type EntryStatusItem
} from '../../slots/contentSlots';

/**
 * The status items contributed through `ENTRY_STATUS_ITEM_SLOT`, for the open
 * record. A hook in a loop, safe for the reason every hook-style item in this
 * package relies on: slot items are boot-frozen, so the list never changes
 * length between renders. `appliesTo` filters the **result**, never the call,
 * so the hook count cannot change when the open type does.
 *
 * Like the publish guards, nothing is asked without a slot context — the
 * editor always renders inside one, so the condition never flips mid-life.
 */
export function useEntryStatusItems(
    context: EntrySlotContext | null,
    state: { dirty: boolean }
): EntryStatusItem[] {
    const out: EntryStatusItem[] = [];
    for (const contribution of ENTRY_STATUS_ITEM_SLOT.getItems()) {
        const item = context ? contribution.useItem(context, state) : null;
        if (!item || !context) continue;
        if (contribution.appliesTo && !contribution.appliesTo(context.schema))
            continue;
        out.push(item);
    }
    return out;
}
