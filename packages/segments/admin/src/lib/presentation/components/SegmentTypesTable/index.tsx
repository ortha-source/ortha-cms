import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    cn
} from '@orthacms/design-system';
import type { SegmentType } from '../../../domain/types/segmentType';
import { SegmentTypeRowActions } from './SegmentTypeRowActions';

const messages = defineMessages({
    caption: {
        id: 'segments.types.caption',
        defaultMessage:
            'Segment types, with the projection slot each one holds.'
    },
    colName: { id: 'segments.types.colName', defaultMessage: 'Type' },
    colKey: { id: 'segments.types.colKey', defaultMessage: 'Namespace' },
    colSegments: {
        id: 'segments.types.colSegments',
        defaultMessage: 'Segments'
    },
    colSlot: { id: 'segments.types.colSlot', defaultMessage: 'Slot' },
    colState: { id: 'segments.types.colState', defaultMessage: 'State' },
    stateActive: { id: 'segments.types.stateActive', defaultMessage: 'Active' },
    stateDraining: {
        id: 'segments.types.stateDraining',
        defaultMessage: 'Retiring'
    },
    stateFree: { id: 'segments.types.stateFree', defaultMessage: 'Retired' },
    managedByConfig: {
        id: 'segments.types.managedByConfig',
        defaultMessage: 'From config'
    },
    cardinalityHigh: {
        id: 'segments.types.cardinalityHigh',
        defaultMessage: 'Searchable'
    },
    select: {
        id: 'segments.types.select',
        defaultMessage: 'Show the segments of {name}'
    }
});

/** Props for {@link SegmentTypesTable}. */
type SegmentTypesTableProps = {
    /** The rows. */
    types: readonly SegmentType[];
    /** Which row is selected, so its segments show below. */
    selectedId: string | null;
    /** Selects a row. */
    onSelect: (type: SegmentType) => void;
    /** Whether the caller holds `access:manage`. */
    canManage: boolean;
    /** Opens the rename dialog. */
    onRename: (type: SegmentType) => void;
    /** Retires a type. */
    onRetire: (type: SegmentType) => void;
    /** The id of the type whose retirement is in flight, if any. */
    retiringId: string | null;
};

/** Which badge variant a lifecycle state reads as. */
function stateVariant(
    state: SegmentType['state']
): 'default' | 'secondary' | 'outline' {
    if (state === 'active') return 'default';
    if (state === 'draining') return 'secondary';
    return 'outline';
}

/**
 * The segment-type directory.
 *
 * The **slot** column is not an implementation detail leaking into the UI: it
 * is the scarce resource. There are eight, a retired type holds one until its
 * columns are cleared, and "all slots are held" is an error an administrator
 * will otherwise meet for the first time as a 409 on the create dialog. Showing
 * which type holds which slot is what makes that number legible before it bites.
 *
 * Selecting a row is what reveals its segments below — one page, not two,
 * because a type is nothing without them and a directory of eight rows does not
 * earn a navigation.
 */
export function SegmentTypesTable({
    types,
    selectedId,
    onSelect,
    canManage,
    onRename,
    onRetire,
    retiringId
}: SegmentTypesTableProps) {
    const intl = useIntl();

    const stateLabel = (state: SegmentType['state']) =>
        state === 'active'
            ? intl.formatMessage(messages.stateActive)
            : state === 'draining'
              ? intl.formatMessage(messages.stateDraining)
              : intl.formatMessage(messages.stateFree);

    return (
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs">
            <Table>
                <caption className="sr-only">
                    {intl.formatMessage(messages.caption)}
                </caption>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            {intl.formatMessage(messages.colName)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.colKey)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.colSegments)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.colSlot)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.colState)}
                        </TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {types.map((type) => (
                        <TableRow
                            key={type.id}
                            className={cn(
                                selectedId === type.id && 'bg-muted/50'
                            )}
                        >
                            <TableCell className="font-medium">
                                {/* A button, not a row click: the row also
                                    carries a menu, and a clickable <tr> makes
                                    the two targets indistinguishable to a
                                    keyboard and to a screen reader. */}
                                <button
                                    type="button"
                                    className="text-left hover:underline"
                                    aria-pressed={selectedId === type.id}
                                    aria-label={intl.formatMessage(
                                        messages.select,
                                        { name: type.label }
                                    )}
                                    onClick={() => onSelect(type)}
                                >
                                    {type.label}
                                </button>
                                {type.managedBy === 'config' ? (
                                    <Badge
                                        variant="outline"
                                        className="ml-2 align-middle"
                                    >
                                        {intl.formatMessage(
                                            messages.managedByConfig
                                        )}
                                    </Badge>
                                ) : null}
                            </TableCell>
                            <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                    {type.key}:
                                </code>
                                {type.cardinality === 'high' ? (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.cardinalityHigh
                                        )}
                                    </span>
                                ) : null}
                            </TableCell>
                            <TableCell className="tabular-nums">
                                {type.segmentCount}
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                                {type.state === 'free' ? '—' : type.slot}
                            </TableCell>
                            <TableCell>
                                <Badge variant={stateVariant(type.state)}>
                                    {stateLabel(type.state)}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <SegmentTypeRowActions
                                    type={type}
                                    canManage={canManage}
                                    onRename={onRename}
                                    onRetire={onRetire}
                                    retiring={retiringId === type.id}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
