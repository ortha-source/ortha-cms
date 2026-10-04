import type {
    ClassifiedChange,
    SchemaPlan
} from '@orthacms/schema-builder-domain';
import { MIGRATION_NAME } from '../migrationName';

/** Whether the review may apply, and what stands in the way when not. */
export type ApplyReadiness =
    | { ok: true }
    | { ok: false; reason: 'blocked' | 'nothing' | 'name'; missing?: undefined }
    | { ok: false; reason: 'unconfirmed'; missing: readonly string[] };

/** The destructive changes not yet confirmed — each needs its own tick. */
export const unconfirmed = (
    changes: readonly ClassifiedChange[],
    confirmed: ReadonlySet<string>
): string[] =>
    changes
        .filter(
            (change) =>
                change.safety === 'destructive' && !confirmed.has(change.id)
        )
        .map((change) => change.id);

/** The UX mirror of the server's apply checks — the server still decides. */
export function applyReadiness(
    plan: SchemaPlan,
    confirmed: ReadonlySet<string>,
    migrationName: string
): ApplyReadiness {
    if (plan.blocked) return { ok: false, reason: 'blocked' };
    if (plan.changes.length === 0) return { ok: false, reason: 'nothing' };
    const missing = unconfirmed(plan.changes, confirmed);
    if (missing.length) return { ok: false, reason: 'unconfirmed', missing };
    if (!MIGRATION_NAME.test(migrationName))
        return { ok: false, reason: 'name' };
    return { ok: true };
}

/** The types a plan creates — the ones to offer to workspaces afterwards. */
export const createdTypes = (plan: SchemaPlan): string[] =>
    plan.changes
        .filter((change) => change.change.kind === 'type.add')
        .map((change) => change.change.type);
