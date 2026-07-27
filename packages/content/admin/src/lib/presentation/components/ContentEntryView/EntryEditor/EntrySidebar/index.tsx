import type { EntryRecord } from '../../../../../domain/types/contentType';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import { ENTRY_SIDEBAR_WIDGET_SLOT } from '../../../../slots/contentSlots';
import { PublishGate, type PublishGateItem } from './PublishGate';
import { DetailsBlock } from './DetailsBlock';
import { RevisionWidget } from '../RevisionWidget';

/** Re-exported for the editor, which computes the gate items. */
export type { PublishGateItem };

/**
 * The body of the entry editor's **Properties** panel — one flat surface, not a
 * column of floating cards: a run of `EntrySidebarSection`s told apart by
 * dividers (a live {@link PublishGate} on publishable types, the static
 * {@link DetailsBlock}, the {@link RevisionWidget}, and any slot-contributed
 * widget), each using the same section chrome so a contribution can't drift into
 * its own look.
 *
 * It renders **chrome-less**: the panel column, its heading and its collapse
 * toggle belong to the shell's right-panel region, which `EntryEditor` fills
 * through `RightPanelPortal`. The portal keeps this inside the editor's React
 * tree, so `useEntrySlotContext` and `useCurrentWorkspace` still resolve even
 * though the DOM lives in the app shell.
 *
 * The write actions are **not** here — they render in the page top bar
 * (`EntryActions`), because this panel can be collapsed away entirely.
 */
export function EntrySidebar({
    entry,
    publishable,
    isCreate,
    gate = []
}: {
    entry?: EntryRecord;
    publishable: boolean;
    isCreate: boolean;
    /** The publish-gate checks (publishable types only). */
    gate?: PublishGateItem[];
}) {
    // Slot-contributed rail widgets (e.g. the i18n plugin's locale panel),
    // rendered below the Revisions block with the surrounding editor's context.
    const slotContext = useEntrySlotContext();
    const widgets = ENTRY_SIDEBAR_WIDGET_SLOT.getItems();

    return (
        // One surface, sections told apart by dividers — the divider is this
        // wrapper's, so every block (including a contributed widget) is
        // separated the same way without drawing its own border.
        <div className="flex flex-col divide-y divide-border/60">
            <PublishGate items={gate} publishable={publishable} />

            <DetailsBlock
                entry={entry}
                publishable={publishable}
                isCreate={isCreate}
            />

            {slotContext && entry?.id ? (
                <RevisionWidget
                    typeName={slotContext.schema.name}
                    entryId={entry.id}
                    schema={slotContext.schema}
                />
            ) : null}

            {slotContext
                ? widgets.map((item) => (
                      <item.Component key={item.id} {...slotContext} />
                  ))
                : null}
        </div>
    );
}
