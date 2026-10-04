import { Badge } from '@orthacms/design-system';
import type { FieldEntry } from '@orthacms/schema-builder-domain';
import { fieldFacts } from '../../../../../domain/fieldFacts';
import { FieldFactList } from './FieldFactList';
import { FieldTypeIcon } from './FieldTypeIcon';

/** One field: its type, machine name, label, what is notable about it, and its type in words. */
export function FieldRow({ entry }: { entry: FieldEntry }) {
    const label = entry.spec.admin?.label;
    return (
        <li className="flex min-h-12 items-center gap-3 px-4 py-2">
            <FieldTypeIcon type={entry.spec.type} />
            <span className="flex min-w-0 flex-col">
                <span className="font-mono text-sm">{entry.name}</span>
                {label && (
                    <span className="truncate text-xs text-muted-foreground">
                        {label}
                    </span>
                )}
            </span>
            <FieldFactList facts={fieldFacts(entry.spec)} />
            <Badge variant="secondary" className="ml-auto shrink-0 font-normal">
                {entry.spec.type}
            </Badge>
        </li>
    );
}
