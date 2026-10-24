import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import {
    advance,
    failProgress,
    startProgress,
    type ApplyProgress
} from '../../domain/applyProgress';
import {
    applyReadiness,
    createdTypes,
    type ApplyReadiness
} from '../../domain/applyReadiness';
import { suggestMigrationName } from '../../domain/migrationName';
import type { SchemaGateway } from '../../domain/schemaGateway';
import { httpSchemaGateway } from '../../infrastructure/httpSchemaGateway';
import { isRegistryKey } from '../../infrastructure/isRegistryKey';
import { schemaKeys } from '../../infrastructure/schemaKeys';
import type { PollOptions } from '../polling';
import type { SchemaDraftState } from '../useSchemaDraft';
import { waitForOperation } from '../waitForOperation';
import { waitForRestart } from '../waitForRestart';

/** Where an apply stands, as the page shows it. */
export type ApplyStage =
    | 'idle'
    | 'applying'
    | 'restarting'
    | 'manual'
    | 'done'
    | 'failed';

/** Why an apply failed, in a form the page can show. */
export type ApplyFailure = { readonly code?: string; readonly message: string };

/** The review and apply, for one served document and its draft. */
export type ApplyFlow = ReturnType<typeof useApplyFlow>;

type Options = { gateway?: SchemaGateway; poll?: PollOptions };

/**
 * Review → confirm → apply → wait for the restart → grant. The plan is asked
 * for when the review opens; destructive changes are confirmed one by one;
 * the apply is followed through its operation, then the restart through the
 * boot id. Once the new process answers, every cache built from the registry
 * is refreshed — the draft resets itself to the new document.
 */
export function useApplyFlow(
    envelope: SchemaDocumentEnvelope,
    draft: SchemaDraftState,
    { gateway = httpSchemaGateway, poll }: Options = {}
) {
    const queryClient = useQueryClient();
    const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
    const [migrationName, setMigrationName] = useState('');
    const [stage, setStage] = useState<ApplyStage>('idle');
    const [failure, setFailure] = useState<ApplyFailure | null>(null);
    const [created, setCreated] = useState<string[]>([]);
    const [progress, setProgress] = useState<ApplyProgress | null>(null);
    // What the outcome page says: what was applied, by which migration.
    const [applied, setApplied] = useState<{
        changes: number;
        migrations: readonly string[];
    } | null>(null);

    const plan = useMutation({
        mutationFn: () => gateway.plan(draft.document, envelope.fingerprint),
        onMutate: () => {
            setConfirmed(new Set());
            setMigrationName(suggestMigrationName(draft.changes));
        }
    });

    const { mutate: requestPlan } = plan;
    /** Asks for a fresh plan of the current draft — every time the review opens. */
    const review = useCallback(() => requestPlan(), [requestPlan]);

    const toggle = useCallback((id: string) => {
        setConfirmed((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const readiness: ApplyReadiness | null = plan.data
        ? applyReadiness(plan.data, confirmed, migrationName)
        : null;

    const apply = async () => {
        if (!plan.data || !readiness?.ok) return;
        const types = createdTypes(plan.data);
        const changes = plan.data.changes.length;
        setFailure(null);
        setApplied(null);
        setProgress(startProgress(Date.now()));
        setStage('applying');
        try {
            const accepted = await gateway.apply({
                document: draft.document,
                baseFingerprint: envelope.fingerprint,
                migrationName,
                confirmed: [...confirmed]
            });
            const operation = await waitForOperation(
                gateway,
                accepted.operationId,
                poll,
                ({ step }) => {
                    if (step)
                        setProgress(
                            (current) =>
                                current && advance(current, step, Date.now())
                        );
                }
            );
            if (operation.status !== 'succeeded') {
                setProgress(
                    (current) =>
                        current &&
                        failProgress(current, operation.step, Date.now())
                );
                setFailure(
                    operation.error ?? {
                        code: operation.status,
                        message: 'The apply stopped before it finished.'
                    }
                );
                setStage('failed');
                return;
            }
            const manual = envelope.capabilities.restart === 'manual';
            setApplied({ changes, migrations: operation.migrations });
            setProgress(
                (current) => current && advance(current, 'restart', Date.now())
            );
            setStage(manual ? 'manual' : 'restarting');
            const next = await waitForRestart(
                gateway,
                accepted.bootId,
                manual ? { timeoutMs: 30 * 60_000, ...poll } : poll
            );
            queryClient.setQueryData(schemaKeys.document(), next);
            await queryClient.invalidateQueries({
                predicate: (query) => isRegistryKey(query.queryKey)
            });
            setCreated(types);
            setProgress(
                (current) => current && advance(current, 'ready', Date.now())
            );
            setStage('done');
        } catch (error) {
            setProgress(
                (current) => current && failProgress(current, null, Date.now())
            );
            setFailure({ message: (error as Error).message });
            setStage('failed');
        }
    };

    return {
        review,
        plan,
        confirmed,
        toggle,
        migrationName,
        setMigrationName,
        readiness,
        apply,
        stage,
        /** The apply's steps as this tab saw them, with their times. */
        progress,
        /** After a successful apply: how many changes, which migrations. */
        applied,
        failure,
        /** Types the last apply created, to offer to workspaces and to open. */
        created,
        dismiss: () => {
            setStage('idle');
            setFailure(null);
        }
    };
}
