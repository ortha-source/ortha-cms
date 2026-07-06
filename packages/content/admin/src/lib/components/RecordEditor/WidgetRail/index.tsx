import { Fragment } from 'react';
import type { RecordDraft } from '../../../types/recordDraft';
import type { RecordEditor } from '../../../hooks/useRecordEditor';
import { RECORD_WIDGET_SLOT } from '../../../slots/recordWidgetSlot';
import { PublishGateWidget } from './PublishGateWidget';
import { DetailsWidget } from './DetailsWidget';
import { LocaleWidget } from './LocaleWidget';

/**
 * The right widget rail: the three built-in widgets (Publish gate → Details →
 * Locale) followed by every plugin-contributed widget in order. Its own scroll
 * container, so a tall rail never drives the page — only the form pane scrolls.
 */
export function WidgetRail({
    draft,
    editor,
    onJump,
    onSwitchLocale
}: {
    draft: RecordDraft;
    editor: RecordEditor;
    onJump: (key: string) => void;
    onSwitchLocale: (code: string) => void;
}) {
    const widgets = [...RECORD_WIDGET_SLOT.getItems()].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );

    return (
        <aside className="flex w-[300px] flex-none flex-col gap-5 overflow-y-auto">
            <PublishGateWidget
                items={editor.gate.items}
                blocking={editor.gate.blocking}
                onFix={onJump}
            />
            <DetailsWidget
                id={draft.id}
                status={editor.status}
                createdAt={editor.createdAt}
                updatedAt={editor.updatedAt}
            />
            <LocaleWidget
                locales={draft.locales}
                activeCode={draft.locale}
                onSwitch={onSwitchLocale}
            />
            {widgets.map((widget) => (
                <Fragment key={widget.id}>
                    {widget.render({ draft, editor, onJump })}
                </Fragment>
            ))}
        </aside>
    );
}
