import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import {
    Badge,
    Button,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type { Assignment } from '../../../domain/types/accessTarget';

const messages = defineMessages({
    heading: {
        id: 'segments.assignments.heading',
        defaultMessage: 'Where rules apply'
    },
    hint: {
        id: 'segments.assignments.hint',
        defaultMessage:
            'The levels merge: a workspace rule and a collection rule both apply to an entry inside that collection. An entry’s own rule is set from the entry editor.'
    },
    colTarget: {
        id: 'segments.assignments.colTarget',
        defaultMessage: 'Applies to'
    },
    colRule: { id: 'segments.assignments.colRule', defaultMessage: 'Rule' },
    workspace: {
        id: 'segments.assignments.workspace',
        defaultMessage: 'This whole workspace'
    },
    type: {
        id: 'segments.assignments.type',
        defaultMessage: 'Collection “{slug}”'
    },
    entry: {
        id: 'segments.assignments.entry',
        defaultMessage: 'One entry in “{slug}”'
    },
    remove: {
        id: 'segments.assignments.remove',
        defaultMessage: 'Stop applying {rule} to {target}'
    },
    empty: {
        id: 'segments.assignments.empty',
        defaultMessage:
            'No rule is applied anywhere in this workspace, so every published entry is readable by everyone.'
    },
    level: { id: 'segments.assignments.level', defaultMessage: 'Level' }
});

/** Props for {@link AssignmentsCard}. */
type AssignmentsCardProps = {
    /** Every assignment in the workspace. */
    assignments: readonly Assignment[];
    /** Whether the caller holds `access:manage`. */
    canManage: boolean;
    /** Removes an assignment. */
    onUnassign: (assignment: Assignment) => void;
    /** The id whose removal is in flight, if any. */
    removingId: string | null;
};

/** How specific a target is — the order the levels merge in. */
const LEVEL_ORDER: Record<Assignment['target']['kind'], number> = {
    workspace: 0,
    type: 1,
    entry: 2
};

/**
 * Every rule assignment in the workspace, least specific first.
 *
 * Sorted by level rather than by rule, because the order **is** the merge order:
 * an entry inside a collection is governed by the workspace row, then the
 * collection row, then its own. Reading the list top to bottom is reading the
 * inheritance chain, which is the one thing an editor asking "why is this
 * hidden" needs and cannot get from a rule library.
 */
export function AssignmentsCard({
    assignments,
    canManage,
    onUnassign,
    removingId
}: AssignmentsCardProps) {
    const intl = useIntl();

    const sorted = [...assignments].sort(
        (a, b) =>
            LEVEL_ORDER[a.target.kind] - LEVEL_ORDER[b.target.kind] ||
            (a.target.typeSlug ?? '').localeCompare(b.target.typeSlug ?? '')
    );

    const targetLabel = (assignment: Assignment) => {
        const { kind, typeSlug } = assignment.target;
        if (kind === 'workspace') {
            return intl.formatMessage(messages.workspace);
        }
        if (kind === 'type') {
            return intl.formatMessage(messages.type, { slug: typeSlug ?? '' });
        }
        return intl.formatMessage(messages.entry, { slug: typeSlug ?? '' });
    };

    return (
        <section className="mt-8">
            <h2 className="text-lg font-medium">
                {intl.formatMessage(messages.heading)}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {intl.formatMessage(messages.hint)}
            </p>

            {sorted.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    {intl.formatMessage(messages.colTarget)}
                                </TableHead>
                                <TableHead>
                                    {intl.formatMessage(messages.colRule)}
                                </TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sorted.map((assignment) => (
                                <TableRow key={assignment.id}>
                                    <TableCell>
                                        {targetLabel(assignment)}
                                        <Badge
                                            variant="outline"
                                            className="ml-2 align-middle"
                                        >
                                            {assignment.target.kind}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {assignment.ruleLabel}
                                    </TableCell>
                                    <TableCell>
                                        {canManage ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="ml-auto"
                                                disabled={
                                                    removingId === assignment.id
                                                }
                                                aria-label={intl.formatMessage(
                                                    messages.remove,
                                                    {
                                                        rule: assignment.ruleLabel,
                                                        target: targetLabel(
                                                            assignment
                                                        )
                                                    }
                                                )}
                                                onClick={() =>
                                                    onUnassign(assignment)
                                                }
                                            >
                                                {removingId ===
                                                assignment.id ? (
                                                    <Spinner />
                                                ) : (
                                                    <X aria-hidden />
                                                )}
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </section>
    );
}
