import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FieldState } from '../../../../hooks/useRecordEditor';
import { OutlineRow } from '../OutlineRow';

/**
 * A collapsible group of non-problem rows, used by the outline's problems-first
 * mode to fold away the fields that don't need attention. Starts collapsed.
 */
export function OutlineGroup({
    label,
    items,
    activeKey,
    onJump
}: {
    label: string;
    items: FieldState[];
    activeKey?: string;
    onJump: (key: string) => void;
}) {
    const [open, setOpen] = useState(false);
    if (items.length === 0) return null;
    return (
        <div className="mt-1">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full items-center gap-1.5 rounded-r-md px-2.5 py-[5px] text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
                {open ? (
                    <ChevronDown className="size-3" aria-hidden />
                ) : (
                    <ChevronRight className="size-3" aria-hidden />
                )}
                <span className="uppercase tracking-wide">{label}</span>
                <span className="tabular-nums">{items.length}</span>
            </button>
            {open
                ? items.map((state) => (
                      <OutlineRow
                          key={state.field.key}
                          state={state}
                          active={state.field.key === activeKey}
                          onJump={onJump}
                      />
                  ))
                : null}
        </div>
    );
}
