import { cn } from '@ortha-cms/design-system';
import type { FieldState } from '../../../../hooks/useRecordEditor';

/**
 * One field row in the outline: a status dot + label, with the active
 * left-border indicator. The dot is red when the field blocks publish, solid
 * when filled, hollow when empty; a blocking row also carries a trailing `!`.
 */
export function OutlineRow({
    state,
    active,
    onJump
}: {
    state: FieldState;
    active: boolean;
    onJump: (key: string) => void;
}) {
    const { field, filled, blocking } = state;
    return (
        <button
            type="button"
            onClick={() => onJump(field.key)}
            className={cn(
                'flex items-center gap-2 rounded-r-md border-l-2 px-2.5 py-[5px] text-left text-[13px] transition-colors hover:bg-accent',
                active ? 'border-foreground' : 'border-transparent',
                blocking
                    ? 'text-destructive'
                    : active
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    blocking
                        ? 'bg-destructive'
                        : filled
                          ? 'bg-foreground'
                          : 'border border-muted-foreground'
                )}
            />
            <span className="min-w-0 flex-1 truncate">{field.label}</span>
            {blocking ? (
                <span
                    className="shrink-0 text-[11px] font-semibold"
                    aria-hidden
                >
                    !
                </span>
            ) : null}
        </button>
    );
}
