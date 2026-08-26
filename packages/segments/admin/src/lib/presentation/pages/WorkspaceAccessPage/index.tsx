import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, ShieldCheck } from 'lucide-react';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    toast
} from '@orthacms/design-system';
import type { AccessRule } from '../../../domain/types/accessRule';
import { isGlobal } from '../../../domain/types/accessRule';
import type { Assignment } from '../../../domain/types/accessTarget';
import { useSegmentTypes } from '../../../application/useSegmentTypes';
import { useAccessRules } from '../../../application/useAccessRules';
import { useAssignments } from '../../../application/useAssignments';
import {
    useCreateAccessRule,
    useDeleteAccessRule,
    useUpdateAccessRule
} from '../../../application/useAccessRuleMutations';
import { useUnassignRule } from '../../../application/useAssignmentMutations';
import { AccessRulesTable } from '../../components/AccessRulesTable';
import { AssignmentsCard } from '../../components/AssignmentsCard';
import { AccessTableSkeleton } from '../../components/AccessSkeleton';
import { AccessNoAccess } from '../../components/AccessNoAccess';
import {
    RuleEditorDialog,
    type RuleDraft
} from '../../components/RuleEditorDialog';

const messages = defineMessages({
    title: { id: 'segments.workspace.title', defaultMessage: 'Access' },
    subtitle: {
        id: 'segments.workspace.subtitle',
        defaultMessage:
            'Which readers may see this workspace’s published content, and where each rule applies.'
    },
    create: { id: 'segments.workspace.create', defaultMessage: 'New rule' },
    error: {
        id: 'segments.workspace.error',
        defaultMessage: 'Couldn’t load the access rules.'
    },
    writeError: {
        id: 'segments.workspace.writeError',
        defaultMessage: 'Couldn’t save that. Please try again.'
    },
    notConfiguredTitle: {
        id: 'segments.workspace.notConfiguredTitle',
        defaultMessage: 'Nothing is segmented yet'
    },
    notConfiguredBody: {
        id: 'segments.workspace.notConfiguredBody',
        defaultMessage:
            'A rule needs an axis to talk about. Create a segment type under Segmentation first — until one exists, every published entry is readable by everyone and nothing about the content API changes.'
    },
    emptyTitle: {
        id: 'segments.workspace.emptyTitle',
        defaultMessage: 'No rules yet'
    },
    emptyBody: {
        id: 'segments.workspace.emptyBody',
        defaultMessage:
            'A rule is a reusable answer to “who may read this”. Write one here, then apply it to this workspace, a collection, or a single entry.'
    },
    ruleSaved: {
        id: 'segments.workspace.ruleSaved',
        defaultMessage:
            '“{name}” saved — everything it applies to now serves the new answer'
    }
});

/**
 * The workspace-scoped Access page at `/workspaces/:id/access`.
 *
 * Two blocks: the rule library, and where each rule is applied. Deliberately
 * separate, because they answer different questions and change at different
 * rates — a rule is written once and reused, while an assignment is the act of
 * pointing it at content. Merging them into one "restricted content" list would
 * lose the reuse that makes a rule worth having.
 *
 * Assigning is **not** done here. It happens where the content is: from the
 * entry editor's Access tab for one entry, and — when the collection-level
 * surface lands — from the collection. This page removes assignments (that is a
 * library-side act, and the only place all of them are visible at once) but
 * does not create them, because choosing a target from a dropdown is exactly
 * how a rule ends up on the wrong collection.
 */
export function WorkspaceAccessPage() {
    const intl = useIntl();
    useDocumentTitle(intl.formatMessage(messages.title));
    const workspace = useCurrentWorkspace();
    const workspaceId = workspace?.id ?? '';
    const canRead = useHasPermission('access:read');
    const canManage = useHasPermission('access:manage');

    const types = useSegmentTypes(canRead);
    const rules = useAccessRules(workspaceId, canRead);
    const assignments = useAssignments(workspaceId, canRead);

    const createRule = useCreateAccessRule(workspaceId);
    const updateRule = useUpdateAccessRule(workspaceId);
    const deleteRule = useDeleteAccessRule(workspaceId);
    const unassign = useUnassignRule(workspaceId);

    const [editor, setEditor] = useState<{
        open: boolean;
        editing: AccessRule | null;
    }>({ open: false, editing: null });

    // Only an active type can be named in a condition: a draining one is
    // already out of the predicate, so a rule mentioning it would be authored
    // against an axis that decides nothing.
    const activeTypes = useMemo(
        () => (types.data ?? []).filter((type) => type.state === 'active'),
        [types.data]
    );

    if (!canRead) {
        return (
            <div className="p-6">
                <AccessNoAccess />
            </div>
        );
    }

    const failed = () => toast.error(intl.formatMessage(messages.writeError));

    const submit = (draft: RuleDraft) => {
        const editing = editor.editing;
        const done = (rule: AccessRule) => {
            setEditor({ open: false, editing: null });
            toast.success(
                intl.formatMessage(messages.ruleSaved, { name: rule.label })
            );
        };
        if (editing) {
            updateRule.mutate(
                { id: editing.id, ...draft },
                { onSuccess: done, onError: failed }
            );
            return;
        }
        createRule.mutate(draft, { onSuccess: done, onError: failed });
    };

    const isPending =
        types.isPending || rules.isPending || assignments.isPending;
    const isError = types.isError || rules.isError || assignments.isError;
    const ruleList = rules.data ?? [];
    const configured = activeTypes.length > 0;

    return (
        <div className="p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {intl.formatMessage(messages.title)}
                    </h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        {intl.formatMessage(messages.subtitle)}
                    </p>
                </div>
                {canManage && configured ? (
                    <Button
                        onClick={() => setEditor({ open: true, editing: null })}
                    >
                        <Plus aria-hidden />
                        {intl.formatMessage(messages.create)}
                    </Button>
                ) : null}
            </div>

            {isPending ? (
                <AccessTableSkeleton columns={4} />
            ) : isError ? (
                <Alert variant="destructive" role="alert">
                    <AlertDescription>
                        {intl.formatMessage(messages.error)}
                    </AlertDescription>
                </Alert>
            ) : !configured ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ShieldCheck aria-hidden />
                        </EmptyMedia>
                        <EmptyTitle>
                            {intl.formatMessage(messages.notConfiguredTitle)}
                        </EmptyTitle>
                        <EmptyDescription>
                            {intl.formatMessage(messages.notConfiguredBody)}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    {ruleList.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <ShieldCheck aria-hidden />
                                </EmptyMedia>
                                <EmptyTitle>
                                    {intl.formatMessage(messages.emptyTitle)}
                                </EmptyTitle>
                                <EmptyDescription>
                                    {intl.formatMessage(messages.emptyBody)}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        <AccessRulesTable
                            rules={ruleList}
                            canManage={canManage}
                            onOpen={(rule) =>
                                setEditor({ open: true, editing: rule })
                            }
                            onDelete={(rule) =>
                                deleteRule.mutate(rule.id, { onError: failed })
                            }
                            deletingId={
                                deleteRule.isPending
                                    ? (deleteRule.variables ?? null)
                                    : null
                            }
                        />
                    )}

                    <AssignmentsCard
                        assignments={assignments.data ?? []}
                        canManage={canManage}
                        onUnassign={(assignment: Assignment) =>
                            unassign.mutate(assignment.id, { onError: failed })
                        }
                        removingId={
                            unassign.isPending
                                ? (unassign.variables ?? null)
                                : null
                        }
                    />
                </>
            )}

            <RuleEditorDialog
                open={editor.open}
                onOpenChange={(open) =>
                    setEditor((current) => ({ ...current, open }))
                }
                editing={editor.editing}
                types={activeTypes}
                editable={
                    canManage && (!editor.editing || !isGlobal(editor.editing))
                }
                onSubmit={submit}
                submitting={createRule.isPending || updateRule.isPending}
            />
        </div>
    );
}
