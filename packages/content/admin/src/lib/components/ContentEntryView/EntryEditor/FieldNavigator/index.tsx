import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@ortha-cms/design-system';
import type { FieldState } from '../../../../hooks/useRecordEditor';

const messages = defineMessages({
    title: { id: 'content.editor.navTitle', defaultMessage: 'Fields' },
    hint: {
        id: 'content.editor.navHint',
        defaultMessage: 'Click a cell to jump, or press ⌘J to search.'
    }
});

/** First letter of a field label, for the keycap glyph. */
function initial(label: string): string {
    return label.trim().charAt(0).toUpperCase() || '·';
}

/**
 * A compact **field minimap** for the editor's right rail: one keycap per field,
 * tinted by state (filled = solid, empty = outline, blocking = destructive) and
 * ringed when active. Clicking a cell jumps to + focuses that field; the active
 * cell tracks the form's scroll-spy. Hover (or a screen reader) reveals the full
 * label, and ⌘J opens the searchable palette for many-field schemas.
 */
export function FieldNavigator({
    fieldStates,
    activeKey,
    filledCount,
    totalCount,
    onJump
}: {
    fieldStates: FieldState[];
    activeKey?: string;
    filledCount: number;
    totalCount: number;
    onJump: (key: string) => void;
}) {
    const intl = useIntl();
    return (
        <nav
            aria-label={intl.formatMessage(messages.title)}
            className="rounded-2xl border bg-background p-[18px]"
        >
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-medium text-muted-foreground">
                    {intl.formatMessage(messages.title)}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                    {filledCount}/{totalCount}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                {fieldStates.map((state) => {
                    const active = state.field.key === activeKey;
                    return (
                        <button
                            key={state.field.key}
                            type="button"
                            title={state.field.label}
                            aria-label={state.field.label}
                            aria-current={active || undefined}
                            onClick={() => onJump(state.field.key)}
                            className={cn(
                                'grid size-7 place-items-center rounded-md border text-xs font-semibold transition-colors',
                                state.blocking
                                    ? 'border-destructive text-destructive'
                                    : state.filled
                                      ? 'border-foreground bg-foreground text-background'
                                      : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                                active &&
                                    'ring-2 ring-ring ring-offset-1 ring-offset-background'
                            )}
                        >
                            {initial(state.field.label)}
                        </button>
                    );
                })}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
                {intl.formatMessage(messages.hint)}
            </p>
        </nav>
    );
}
