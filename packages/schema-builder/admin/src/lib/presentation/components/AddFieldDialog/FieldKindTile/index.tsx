import { useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { FieldCatalogEntry } from '../../../../domain/fieldCatalog';
import { FieldTypeIcon } from '../../FieldTypeIcon';
import { kindCopy } from '../../fieldKindCopy';

type Props = {
    entry: FieldCatalogEntry;
    selected: boolean;
    onSelect: () => void;
    /** A double-click picks the kind and moves on. */
    onConfirm: () => void;
};

/** One kind of field: a radio with its icon, its name and an example of what it holds. */
export function FieldKindTile({ entry, selected, onSelect, onConfirm }: Props) {
    const intl = useIntl();
    const copy = kindCopy(entry.id);
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-labelledby={`kind-${entry.id}-label`}
            aria-describedby={`kind-${entry.id}-hint`}
            tabIndex={selected ? 0 : -1}
            onClick={onSelect}
            onDoubleClick={onConfirm}
            data-kind={entry.id}
            title={intl.formatMessage(copy.hint)}
            className={cn(
                'flex items-start gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                selected
                    ? 'border-foreground ring-1 ring-foreground'
                    : 'hover:bg-accent/60'
            )}
        >
            <FieldTypeIcon type={entry.type} />
            <span className="flex min-w-0 flex-col gap-0.5">
                <span
                    id={`kind-${entry.id}-label`}
                    className="text-sm font-medium"
                >
                    {intl.formatMessage(copy.label)}
                </span>
                <span
                    id={`kind-${entry.id}-hint`}
                    className="text-xs leading-snug text-muted-foreground"
                >
                    {intl.formatMessage(copy.example)}
                </span>
            </span>
        </button>
    );
}
