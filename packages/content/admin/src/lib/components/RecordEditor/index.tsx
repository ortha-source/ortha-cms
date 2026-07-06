import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FocusEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { toast } from '@ortha-cms/design-system';
import { FIELD_JUMP_KEY } from '../../constants';
import { isLongForm, type RecordDraft } from '../../types/recordDraft';
import { useRecordEditor } from '../../hooks/useRecordEditor';
import { RecordTopBar } from './RecordTopBar';
import { FieldOutline } from './FieldOutline';
import { RecordForm } from './RecordForm';
import { WidgetRail } from './WidgetRail';
import { FieldJumpPalette } from './FieldJumpPalette';

const messages = defineMessages({
    duplicated: {
        id: 'content.record.toast.duplicated',
        defaultMessage: 'Record duplicated.'
    },
    deleted: {
        id: 'content.record.toast.deleted',
        defaultMessage: 'Record deleted.'
    }
});

/** How far below the pane top a field must clear to become the active one. */
const SPY_OFFSET = 130;

/** Where a jumped-to field lands from the pane top. */
const JUMP_OFFSET = 90;

/** Build the default expand map: the first long-form field open, the rest shut. */
function defaultExpanded(draft: RecordDraft): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    let first = true;
    for (const field of draft.fields) {
        if (!isLongForm(field.type)) continue;
        map[field.key] = first;
        first = false;
    }
    return map;
}

/** Read the persisted expand map for a record, merged over the defaults. */
function loadExpanded(draft: RecordDraft): Record<string, boolean> {
    const base = defaultExpanded(draft);
    try {
        const raw = localStorage.getItem(`ortha:record:expand:${draft.id}`);
        if (raw) return { ...base, ...JSON.parse(raw) };
    } catch {
        // Ignore malformed/unavailable storage — fall back to defaults.
    }
    return base;
}

/**
 * The assembled record editor: the fixed top bar, the three-zone workspace
 * (field outline · scrolling form pane · widget rail), and the ⌘J field-jump
 * palette. Owns the cross-zone interaction state — the active field, the
 * scroll-spy, click-to-jump, and per-record expand persistence — while the
 * value/validation state lives in {@link useRecordEditor}.
 */
export function RecordEditor({
    draft,
    onSwitchLocale,
    onExit
}: {
    draft: RecordDraft;
    /** Switch the edited locale (a route change owned by the page). */
    onSwitchLocale: (code: string) => void;
    /** Leave the editor / re-open the app sidebar. */
    onExit: () => void;
}) {
    const intl = useIntl();
    const editor = useRecordEditor(draft);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [activeKey, setActiveKey] = useState<string | undefined>(
        draft.fields[0]?.key
    );
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
        loadExpanded(draft)
    );
    const [paletteOpen, setPaletteOpen] = useState(false);

    // Persist the expand map per record, so re-opening keeps the user's layout.
    useEffect(() => {
        try {
            localStorage.setItem(
                `ortha:record:expand:${draft.id}`,
                JSON.stringify(expanded)
            );
        } catch {
            // Storage unavailable (private mode / quota) — non-fatal.
        }
    }, [expanded, draft.id]);

    const toggleExpand = useCallback((key: string) => {
        setExpanded((current) => ({ ...current, [key]: !current[key] }));
    }, []);

    // Jump to a field: expand it if long-form, smooth-scroll it to ~90px from
    // the pane top (computed offset, never scrollIntoView), then focus its input.
    const jumpTo = useCallback(
        (key: string) => {
            setActiveKey(key);
            const field = draft.fields.find((entry) => entry.key === key);
            if (field && isLongForm(field.type)) {
                setExpanded((current) =>
                    current[key] ? current : { ...current, [key]: true }
                );
            }
            requestAnimationFrame(() => {
                const container = scrollRef.current;
                const el = document.getElementById(`f-${key}`);
                if (container && el) {
                    const top =
                        container.scrollTop +
                        (el.getBoundingClientRect().top -
                            container.getBoundingClientRect().top) -
                        JUMP_OFFSET;
                    container.scrollTo({
                        top: Math.max(0, top),
                        behavior: 'smooth'
                    });
                }
                requestAnimationFrame(() => {
                    document
                        .getElementById(`input-${key}`)
                        ?.focus({ preventScroll: true });
                });
            });
        },
        [draft.fields]
    );

    // Scroll-spy: the last field whose top edge sits within SPY_OFFSET of the
    // pane top wins. Passive listener — it only reads layout.
    const onScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        const paneTop = container.getBoundingClientRect().top;
        let current: string | undefined;
        for (const field of draft.fields) {
            const el = document.getElementById(`f-${field.key}`);
            if (!el) continue;
            const top = el.getBoundingClientRect().top - paneTop;
            if (top <= SPY_OFFSET) current = field.key;
            else break;
        }
        if (current) setActiveKey(current);
    }, [draft.fields]);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [onScroll]);

    // ⌘/Ctrl-J toggles the field-jump palette.
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === FIELD_JUMP_KEY
            ) {
                event.preventDefault();
                setPaletteOpen((open) => !open);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Focus-driven activation: keep the outline in sync when a field is focused
    // by keyboard (tab), not just by scroll.
    const onPaneFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
        const host = (event.target as HTMLElement).closest('[data-field-key]');
        const key = host?.getAttribute('data-field-key');
        if (key) setActiveKey(key);
    }, []);

    const activeLocale = useMemo(
        () => draft.locales.find((locale) => locale.code === draft.locale),
        [draft.locales, draft.locale]
    );

    const jumpToBlocking = useCallback(() => {
        if (editor.firstBlockingKey) jumpTo(editor.firstBlockingKey);
    }, [editor.firstBlockingKey, jumpTo]);

    return (
        <div className="flex h-svh flex-col bg-muted">
            <RecordTopBar
                collectionLabel={draft.collection.label}
                displayName={editor.displayName}
                status={editor.status}
                saveState={editor.saveState}
                blocking={editor.gate.blocking}
                onShowSidebar={onExit}
                onPublish={editor.publish}
                onJumpToBlocking={jumpToBlocking}
                onDuplicate={() =>
                    toast(intl.formatMessage(messages.duplicated))
                }
                onUnpublish={editor.unpublish}
                onDelete={() => {
                    toast(intl.formatMessage(messages.deleted));
                    onExit();
                }}
            />

            <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
                <FieldOutline
                    fieldStates={editor.fieldStates}
                    activeKey={activeKey}
                    filledCount={editor.filledCount}
                    totalCount={editor.totalCount}
                    requiredRemaining={editor.requiredRemaining}
                    onJump={jumpTo}
                />

                <main
                    ref={scrollRef}
                    onFocus={onPaneFocus}
                    className="min-w-0 flex-1 overflow-y-auto"
                >
                    <RecordForm
                        collection={draft.collection}
                        localeCode={draft.locale}
                        localeLabel={activeLocale?.label ?? draft.locale}
                        fieldStates={editor.fieldStates}
                        activeKey={activeKey}
                        expanded={expanded}
                        onToggleExpand={toggleExpand}
                        onChange={editor.setValue}
                        onBlur={editor.touch}
                    />
                </main>

                <WidgetRail
                    draft={draft}
                    editor={editor}
                    onJump={jumpTo}
                    onSwitchLocale={onSwitchLocale}
                />
            </div>

            <FieldJumpPalette
                open={paletteOpen}
                onOpenChange={setPaletteOpen}
                fieldStates={editor.fieldStates}
                onJump={jumpTo}
            />
        </div>
    );
}
