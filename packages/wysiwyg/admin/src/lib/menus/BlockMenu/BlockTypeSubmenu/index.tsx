import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from '@ortha-cms/design-system';
import type { BlockAttrs } from '@ortha-cms/wysiwyg-core';
import type { BlockTypeGroup } from '../../useBlockTypeItems';

/**
 * A submenu listing every registered block type, grouped. Three entries in the
 * block menu need exactly this list — Turn into, Insert above, Insert below —
 * and they differ only in what they do with the chosen type, so the list is
 * built once and the action is the prop.
 */
export function BlockTypeSubmenu({
    label,
    groups,
    onSelect
}: {
    label: string;
    groups: readonly BlockTypeGroup[];
    onSelect(type: string, attrs: BlockAttrs | undefined): void;
}) {
    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 w-52 overflow-y-auto">
                {groups.map((group) => (
                    <div key={group.id}>
                        <DropdownMenuLabel className="text-muted-foreground text-xs">
                            {group.label}
                        </DropdownMenuLabel>
                        {group.items.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                onSelect={() => onSelect(item.type, item.attrs)}
                            >
                                <item.Icon aria-hidden className="size-4" />
                                {item.label}
                            </DropdownMenuItem>
                        ))}
                    </div>
                ))}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
}
