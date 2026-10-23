import type { ReactNode } from 'react';
import { cn } from '@orthacms/design-system';
import { GrantedContentRow, type GrantedContent } from '../GrantedContentRow';

/** Props for {@link GrantedContentGroup}. */
export type GrantedContentGroupProps = {
    /** The group's name — "This workspace's own", or the source workspace. */
    label: string;
    /** What leads the header strip (the label, with a badge or a tile). */
    heading: ReactNode;
    /** A fact on the right of the header strip ("4 collections · 2 pages"). */
    aside?: string;
    /** The granted items in this group. */
    items: GrantedContent[];
    /** Copy shown when the group has no grants. */
    emptyLabel?: string;
    /** The workspace the grants belong to. */
    workspaceId: string;
    /** Whether remove controls should be offered. */
    canRemove: boolean;
    /** Called with the item to remove. */
    onRemove: (item: GrantedContent) => void;
    /** Whether the grant with this `key` was just added — its row is highlighted. */
    isJustGranted?: (key: string) => boolean;
};

/**
 * One source's slice of the granted-content list: a tinted header strip naming
 * where the records come from, over a framed list of rows (or an empty line).
 * The group is labelled by the same name, so a screen reader hears which
 * source a row belongs to.
 */
export function GrantedContentGroup({
    label,
    heading,
    aside,
    items,
    emptyLabel,
    workspaceId,
    canRemove,
    onRemove,
    isJustGranted
}: GrantedContentGroupProps) {
    return (
        <div
            role="group"
            aria-label={label}
            className="overflow-hidden rounded-xl border bg-card"
        >
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                {heading}
                {aside ? <span className="ml-auto">{aside}</span> : null}
            </div>
            {items.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                    {emptyLabel}
                </p>
            ) : (
                <ul className="divide-y">
                    {items.map((item) => (
                        <li
                            key={item.key}
                            className={cn(
                                isJustGranted?.(item.key) && 'ds-item-enter'
                            )}
                        >
                            <GrantedContentRow
                                // Both classes set `animation`, so the flash
                                // goes on the row inside the item.
                                className={cn(
                                    isJustGranted?.(item.key) && 'ds-flash'
                                )}
                                granted={item}
                                workspaceId={workspaceId}
                                canRemove={canRemove}
                                onRemove={() => onRemove(item)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
