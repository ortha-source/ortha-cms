import { useId, type ReactNode } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Check, Save, Send } from 'lucide-react';
import {
    Button,
    Kbd,
    Spinner,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    cn
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import type { EntryRecord } from '../../../../../domain/types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS,
    PUBLISH_SHORTCUT_KEY,
    SAVE_SHORTCUT_KEY
} from '../../../../../domain/constants';
import {
    ENTRY_STATUS_VIEW,
    entryStatusView
} from '../../../../../domain/entryStatusView';
import { shortcutModifierGlyph } from '../../../../../domain/shortcutModifier';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import { useEntryShortcuts } from '../../../../hooks/useEntryShortcuts';
import { useEntryStatusItems } from '../../../../hooks/useEntryStatusItems';
import {
    ENTRY_PUBLISH_GUARD_SLOT,
    type EntryPublishGuardState,
    type EntryPublishOptions,
    type EntryPublishVerdict,
    type EntrySlotContext,
    type EntryStatusItem
} from '../../../../slots/contentSlots';
import { EntryMenu } from './EntryMenu';
import { EntrySaveState } from './EntrySaveState';
import { EntryStatusCluster } from './EntryStatusCluster';

const messages = defineMessages({
    save: { id: 'content.editor.save', defaultMessage: 'Save' },
    saveDraft: { id: 'content.editor.saveDraft', defaultMessage: 'Save draft' },
    publish: { id: 'content.editor.publish', defaultMessage: 'Publish' },
    publishChanges: {
        id: 'content.editor.publishChanges',
        defaultMessage: 'Publish changes'
    },
    saved: { id: 'content.editor.saved', defaultMessage: 'Saved' },
    upToDate: {
        id: 'content.editor.upToDate',
        defaultMessage: 'Published · up to date'
    }
});

/** The chord as `aria-keyshortcuts` spells it — both modifiers accepted. */
const SAVE_KEYS = `Meta+${SAVE_SHORTCUT_KEY.toUpperCase()} Control+${SAVE_SHORTCUT_KEY.toUpperCase()}`;
const PUBLISH_KEYS = `Meta+Shift+${PUBLISH_SHORTCUT_KEY.toUpperCase()} Control+Shift+${PUBLISH_SHORTCUT_KEY.toUpperCase()}`;

/**
 * The guard slot's answer for this entry: the first refusal, plus every
 * contributed overlay.
 *
 * Every item's hook is called, in slot order, on every render — the same
 * rules-of-hooks contract the other hook-style items here follow. Only the
 * **first** blocking verdict is read, mirroring the server port's "first
 * refusal wins and no later guard is asked"; the difference is that here the
 * later guards are still asked, because not calling a hook is not an option.
 *
 * Overlays are collected from **every** item, blocked or not: a contribution
 * that has just published through its own action still has a dialog on screen
 * for the moment its verdict flips.
 */
function usePublishVerdict(
    context: EntrySlotContext | null,
    state: EntryPublishGuardState
) {
    const items = ENTRY_PUBLISH_GUARD_SLOT.getItems();
    const verdicts: (EntryPublishVerdict | null)[] = [];
    for (const item of items) {
        // A hook in a loop, which is safe here for the reason every hook-style
        // item in this module relies on: slot items are boot-frozen, so the
        // list never changes length between renders. The call is
        // unconditional — a contribution with nothing to say returns `null`
        // rather than being skipped.
        verdicts.push(context ? item.useVerdict(context, state) : null);
    }

    const blocking = verdicts.find((verdict) => verdict?.blocked) ?? null;
    const overlays = items
        .map((item, index) => ({ id: item.id, node: verdicts[index]?.overlay }))
        .filter((entry) => !!entry.node);

    return { blocking, overlays };
}

/**
 * The entry editor's **write actions**, rendered into the page top bar's actions
 * region (`PageActionsPortal`): the save state in words, then an explicit pair —
 * **Save draft** beside **Publish** / **Publish changes** on a publishable type,
 * one **Save** otherwise — then the {@link EntryMenu} holding the rest.
 *
 * The pair follows the action matrix in `docs/design/entry-editor.md`: a button
 * says what a click will do, and with nothing to do it shows the record's state
 * instead, disabled — "✓ Saved", or "✓ Published · up to date" on a published
 * record nobody has edited. ⌘S and ⌘⇧P run the same two handlers, so a chord
 * can never do what the buttons would not.
 *
 * They live in the bar rather than in a side panel because a record you can't
 * save is a trap, and a panel can be closed. Rendered through a portal from
 * inside the editor, so the handlers, the busy state and `useHasPermission` all
 * resolve against the editor's own tree.
 *
 * It also owns the **third** gate on Publish. `content:publish` decides whether
 * it renders at all and the publish gate decides whether the values are
 * complete; a contribution to {@link ENTRY_PUBLISH_GUARD_SLOT} may then refuse
 * the publish for a reason this package never learns. With nothing contributed
 * the button is exactly what the first two gates made it, and a refusal never
 * relabels or restyles it (ADR-0017).
 */
export function EntryActions({
    entry,
    publishable,
    paranoid,
    isCreate,
    saving,
    mutating = false,
    dirty = false,
    onSaveDraft,
    onPublish,
    onUnpublish,
    onDelete,
    issues = [],
    onGoToField
}: {
    entry?: EntryRecord;
    publishable: boolean;
    /** Whether delete is a soft delete (trash) vs a permanent removal. */
    paranoid: boolean;
    isCreate: boolean;
    saving: boolean;
    /** Whether an unpublish/delete action is in flight (disables the bar). */
    mutating?: boolean;
    /**
     * Whether a Save would write anything — the form's values, staged links or
     * a presave step's state. Drives the action matrix, and is handed to the
     * publish guards (a save moves the version an approval is bound to).
     */
    dirty?: boolean;
    /** Save without publishing (Save draft, or a plain Save). */
    onSaveDraft: () => void;
    /**
     * Save (when anything is unsaved) and mark published — only wired for
     * publishable types. Options come from a guard's action, never from here.
     */
    onPublish: (options?: EntryPublishOptions) => void;
    /** Revert a published entry to draft — only on a saved publishable entry. */
    onUnpublish?: () => void;
    /** Delete the entry — only on a saved entry. */
    onDelete?: () => void;
    /**
     * The editor's own status items: each field that blocks publishing
     * (`field:<name>`), shown in the header's status cluster with a guard's
     * refusal and the plugins' reports.
     */
    issues?: EntryStatusItem[];
    /** Scroll a field into view and focus it — the cluster's "Go to field". */
    onGoToField?: (name: string) => void;
}) {
    const intl = useIntl();
    // Always present in practice — `ContentEntryView` wraps the editor in the
    // provider. The menu needs it (contributed items are resolved against it),
    // so it renders only alongside a context rather than with a stand-in.
    const slotContext = useEntrySlotContext();
    const reasonId = useId();

    const canCreate = useHasPermission(CONTENT_CREATE);
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const canSave = isCreate ? canCreate : canUpdate;

    const busy = saving || mutating;
    const published = entry?.status === ENTRY_STATUS.Published;

    const { blocking, overlays } = usePublishVerdict(slotContext, { dirty });
    const contributed = useEntryStatusItems(slotContext, { dirty });

    const showPublish = publishable && canPublish && canSave;
    const showUnpublish =
        !isCreate && publishable && published && canPublish && !!onUnpublish;
    const showDelete = !isCreate && canDelete && !!onDelete;

    // The action matrix. A button says what a click will do — and when there
    // is nothing to do, it shows the record's state instead, disabled, so a
    // clean editor never offers a click that would only append a version.
    const view = entryStatusView(isCreate ? undefined : entry);
    // Live content exists (published, or published with saved edits on top):
    // a publish from here ships *changes*, and says so.
    const live =
        view === ENTRY_STATUS_VIEW.Published ||
        view === ENTRY_STATUS_VIEW.Modified;
    // Nothing a Save would write. A create form is never clean — there is no
    // record yet, so saving it is always something.
    const clean = !isCreate && !dirty;
    // Published, and what is on screen is what is live: one state, no action.
    const upToDate =
        publishable && clean && view === ENTRY_STATUS_VIEW.Published;

    // A guard speaks about publishing, so it says nothing about a Save button.
    // Without this a refusal would silently disable the draft save on a type
    // whose drafts are explicitly still editable.
    const guard = showPublish && !upToDate ? blocking : null;
    const override = guard?.action;

    // Blocked with no way through: the control stays in the tab order and
    // carries its reason as a description, rather than going `disabled`.
    // A `disabled` button is not focusable and holds no tooltip, so the person
    // most likely to need the explanation is the one who cannot reach it —
    // the treatment `GuardedMenuItem` already uses for the same problem.
    const inert = !!guard && !override;

    // Every way to publish — the button and ⌘⇧P — goes through this one
    // handler, so a chord cannot be the door a refusal forgot to close. An
    // override keeps the button an ordinary Publish and hands the click to the
    // contribution, which publishes through `onPublish` once its own ceremony
    // is done.
    // Everything the header has to say beyond the save state, in one list: the
    // fields that block publishing, the guard's refusal (in its own words —
    // the button itself stays an ordinary Publish, ADR-0017), and what the
    // plugins report.
    const statusItems: EntryStatusItem[] = [
        ...(showPublish ? issues : []),
        ...(guard?.reason
            ? [
                  {
                      id: 'publish-guard',
                      severity: 'blocking' as const,
                      label: guard.reason
                  }
              ]
            : []),
        ...contributed
    ];

    const publish = override
        ? () => override.onSelect((options) => onPublish(options))
        : () => onPublish();

    // What the save button is: an action, its saved state, or absent (the
    // reader may not save, or the record is published and up to date — one
    // state button says that).
    const saveMode: 'action' | 'done' | null = !canSave
        ? null
        : upToDate && showPublish
          ? null
          : clean
            ? 'done'
            : 'action';
    const publishMode: 'action' | 'done' | null = !showPublish
        ? null
        : upToDate
          ? 'done'
          : 'action';

    const glyph = shortcutModifierGlyph();
    const saveLabel = intl.formatMessage(
        publishable ? messages.saveDraft : messages.save
    );
    const publishLabel = intl.formatMessage(
        live ? messages.publishChanges : messages.publish
    );

    useEntryShortcuts({
        onSave: saveMode === 'action' && !busy ? onSaveDraft : null,
        onPublish: publishMode === 'action' && !busy && !inert ? publish : null
    });

    /** A state button: what is true now, with nothing to click. */
    const doneButton = (label: MessageDescriptor) => (
        <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            className="text-muted-foreground shadow-none disabled:opacity-100"
        >
            <Check aria-hidden />
            {intl.formatMessage(label)}
        </Button>
    );

    /** A button with its chord in a tooltip, the way the menu shows ⌘K. */
    const withHint = (button: ReactNode, label: string, keys: string[]) => (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
                {label}
                <span className="flex gap-0.5">
                    {keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                    ))}
                </span>
            </TooltipContent>
        </Tooltip>
    );

    // Save is the primary only when there is no Publish beside it.
    const savePrimary = !showPublish;
    const saveButton =
        saveMode === 'done'
            ? doneButton(messages.saved)
            : saveMode === 'action'
              ? withHint(
                    <Button
                        type="button"
                        size="sm"
                        variant={savePrimary ? 'default' : 'outline'}
                        className={cn(!savePrimary && 'shadow-none')}
                        aria-keyshortcuts={SAVE_KEYS}
                        onClick={() => onSaveDraft()}
                        disabled={busy}
                    >
                        {saving && savePrimary ? (
                            <Spinner aria-hidden />
                        ) : (
                            <Save aria-hidden />
                        )}
                        {saveLabel}
                    </Button>,
                    saveLabel,
                    [glyph, SAVE_SHORTCUT_KEY.toUpperCase()]
                )
              : null;

    const publishControl = (
        <Button
            type="button"
            size="sm"
            className={cn(inert && 'opacity-60')}
            aria-disabled={inert || undefined}
            aria-describedby={guard?.reason ? reasonId : undefined}
            aria-keyshortcuts={inert ? undefined : PUBLISH_KEYS}
            onClick={inert ? (event) => event.preventDefault() : publish}
            disabled={busy}
        >
            {saving ? <Spinner aria-hidden /> : <Send aria-hidden />}
            {publishLabel}
        </Button>
    );

    const publishButton =
        publishMode === 'done' ? (
            doneButton(messages.upToDate)
        ) : publishMode === 'action' ? (
            guard?.reason ? (
                <Tooltip>
                    <TooltipTrigger asChild>{publishControl}</TooltipTrigger>
                    <TooltipContent className="max-w-60">
                        {guard.reason}
                    </TooltipContent>
                </Tooltip>
            ) : (
                withHint(publishControl, publishLabel, [
                    glyph,
                    '⇧',
                    PUBLISH_SHORTCUT_KEY.toUpperCase()
                ])
            )
        ) : null;

    return (
        <>
            <EntryStatusCluster items={statusItems} onGoToField={onGoToField} />
            {canSave ? (
                <EntrySaveState
                    dirty={dirty}
                    isCreate={isCreate}
                    updatedAt={entry?.updatedAt}
                    className="hidden md:flex"
                />
            ) : null}
            {saveButton}
            {publishButton}
            {/* The reason is the button's **description**, so it lives beside
                it rather than inside it: text nested in a control joins its
                accessible *name*, which would have a screen reader announce
                "Publish anyway, 2 approvals required, 0 given" as the thing to
                press. `aria-describedby` resolves by id anywhere in the
                document, so nothing is lost by moving it out. The tooltip is
                the visual half of the same sentence, and is why the control
                keeps `aria-disabled` over `disabled` — Radix needs the pointer
                and focus events a disabled button never fires. */}
            {guard?.reason && (
                <span id={reasonId} className="sr-only">
                    {guard.reason}
                </span>
            )}
            {slotContext && (
                <EntryMenu
                    context={slotContext}
                    paranoid={paranoid}
                    busy={busy}
                    showUnpublish={showUnpublish}
                    showDelete={showDelete}
                    onUnpublish={onUnpublish}
                    onDelete={onDelete}
                />
            )}
            {/* Outside the button, which is relabelled and re-rendered as the
                verdict changes — a dialog mounted inside it would close with
                it. Same rule `ENTRY_MENU_SLOT` overlays follow. */}
            {overlays.map((overlay) => (
                <span key={overlay.id}>{overlay.node}</span>
            ))}
        </>
    );
}
