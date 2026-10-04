import { Link } from 'react-router-dom';
import { FileText, Table2 } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { OriginBadge } from '../../OriginBadge';

type Props = { type: TypeDoc; selected: boolean };

/** One type in the rail: a link, so a type is addressable and the back button works. */
export function TypeRailItem({ type, selected }: Props) {
    const Icon = type.kind === 'single' ? FileText : Table2;
    return (
        <li>
            <Link
                to={`/content-model/${type.name}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                    'flex h-9 items-center gap-2 rounded-lg px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'bg-accent font-medium' : 'hover:bg-accent/60'
                )}
            >
                <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                    {type.label ?? type.name}
                </span>
                <OriginBadge origin={type.origin} />
            </Link>
        </li>
    );
}
