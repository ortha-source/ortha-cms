/**
 * Writing a document back into a workspace.
 *
 * Three decisions shape the whole file.
 *
 * **One pipeline, two phases.** The dry run and the real run are the same code
 * with `dryRun` flipped. A preview computed separately would eventually promise
 * something the apply pass does differently, and the preview is precisely the
 * thing people trust before clicking.
 *
 * **Values first, links second.** Records are written without their relations,
 * then the links are applied once every row exists. This costs a second pass
 * and buys correctness on the shapes a topological sort cannot handle at all:
 * a cycle (`post.related → post`), and a pair that reference each other. It
 * also means a document's internal order never matters.
 *
 * **Every write goes through `EntryWriterService`.** Not "mostly" — every one.
 * That service is where field validation, the workspace scope, the
 * relation-target checks, the same-locale rule, the media-asset check,
 * revisions, outbox events and the bound i18n extension all live. An import
 * that reached for the table directly would be a supported way to write rows
 * that none of those rules ever saw.
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { InjectDatabase, UnitOfWork, type Database } from '@orthacms/database';
import type { EventActor } from '@orthacms/database';
import {
    EntryWriterService,
    InjectContentRegistry,
    type AnyContentType,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import {
    CONFLICT_POLICY,
    IMPORT_ACTION,
    IMPORT_REASON,
    TransferAssetMap,
    TransferIdMap,
    countVerdict,
    emptyCounts,
    hasChanges,
    keyFingerprint,
    naturalKeyOf,
    type ConflictPolicy,
    type ImportCounts,
    type ImportPreview,
    type ImportReason,
    type ImportResult,
    type ImportVerdict,
    type TransferDocument,
    type TransferRecord,
    type TransferRef
} from '@orthacms/transfer-domain';
import { TransferSchemaCatalog } from '../../schema/schema-catalog.service';
import {
    ImportMediaService,
    beginMediaRun,
    type ImportMediaRun
} from '../infrastructure/import-media.service';

/** What to import. */
export interface ImportCommand {
    document: TransferDocument;
    /** Asset bytes from the archive, keyed by archive path. */
    assets: Map<string, Buffer>;
    workspaceId: string;
    policy: ConflictPolicy;
    /** Report only — write nothing. */
    dryRun: boolean;
    actor?: EventActor | null;
    /** Permissions the caller actually holds, checked per write. */
    can: { create: boolean; update: boolean };
}

/** A row matched in the target workspace. */
interface Match {
    targetId: string;
}

@Injectable()
export class ImportEntriesUseCase {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService,
        private readonly catalog: TransferSchemaCatalog,
        private readonly media: ImportMediaService,
        private readonly uow: UnitOfWork
    ) {}

    /**
     * Runs the import.
     *
     * The real run happens inside **one** transaction, so a failure halfway
     * leaves nothing behind — a half-imported graph is worse than no import,
     * because nobody can tell which half is real. Asset bytes are the exception
     * the database cannot cover and are handled in `ImportMediaService`.
     */
    async execute(command: ImportCommand): Promise<ImportPreview & ImportResult> {
        const mediaRun = beginMediaRun();
        if (command.dryRun) return this.run(command, mediaRun);
        try {
            return await this.uow.run(() => this.run(command, mediaRun));
        } catch (error) {
            // The rows rolled back with the transaction; the blobs cannot, so
            // they are removed here or they are orphaned forever.
            await this.media.rollbackRun(mediaRun);
            throw error;
        }
    }

    private async run(
        command: ImportCommand,
        mediaRun: ImportMediaRun
    ): Promise<ImportPreview & ImportResult> {
        const { document, workspaceId } = command;
        const counts = emptyCounts();
        const verdicts: ImportVerdict[] = [];
        const ids = new TransferIdMap();
        const assets = new TransferAssetMap();
        const localeGroups = new Map<string, string>();

        // Records whose values were written, paired with the target row, so the
        // second pass can apply their links.
        const linkPass: { record: TransferRecord; targetId: string }[] = [];

        const matches = await this.matchAll(document.records, workspaceId);

        for (const record of document.records) {
            const type = this.registry.get(record.$type);
            const schema = this.catalog.schemaOf(record.$type);
            if (!type || !schema) {
                verdicts.push(
                    this.verdict(record, IMPORT_ACTION.Error, IMPORT_REASON.UnknownType)
                );
                continue;
            }

            const identity = this.identityFor(document, record.$type);
            const key = naturalKeyOf(identity, record.values);
            const match = matches.get(keyFingerprint(record.$type, key));

            const decision = this.decide(
                identity.length > 0,
                match,
                command.policy
            );
            if (decision.action === IMPORT_ACTION.Skip) {
                verdicts.push(
                    this.verdict(record, IMPORT_ACTION.Skip, decision.reason, match?.targetId)
                );
                countVerdict(counts, verdicts[verdicts.length - 1]);
                // Still remembered: a skipped record is a row that *exists*, so
                // other records' references to it must still resolve.
                if (match) {
                    ids.remember(record.$type, record.$id, key, match.targetId);
                }
                continue;
            }
            if (decision.action === IMPORT_ACTION.Error) {
                verdicts.push(
                    this.verdict(record, IMPORT_ACTION.Error, decision.reason)
                );
                countVerdict(counts, verdicts[verdicts.length - 1]);
                continue;
            }

            const needed =
                decision.action === IMPORT_ACTION.Create ? 'create' : 'update';
            if (!command.can[needed]) {
                verdicts.push(
                    this.verdict(record, IMPORT_ACTION.Error, IMPORT_REASON.Forbidden)
                );
                countVerdict(counts, verdicts[verdicts.length - 1]);
                continue;
            }

            const values = await this.resolveMedia(
                record,
                schema,
                command,
                assets,
                counts,
                mediaRun
            );

            if (command.dryRun) {
                verdicts.push(
                    this.verdict(record, decision.action, decision.reason, match?.targetId)
                );
                countVerdict(counts, verdicts[verdicts.length - 1]);
                // The dry run has no new row to point at, but the *key* is
                // enough for the reference report below to be accurate.
                if (match) {
                    ids.remember(record.$type, record.$id, key, match.targetId);
                }
                continue;
            }

            try {
                const targetId =
                    decision.action === IMPORT_ACTION.Create
                        ? await this.create(
                              type,
                              record,
                              values,
                              workspaceId,
                              localeGroups,
                              command.actor
                          )
                        : await this.update(
                              type,
                              match!.targetId,
                              values,
                              workspaceId,
                              command.actor
                          );
                ids.remember(record.$type, record.$id, key, targetId);
                linkPass.push({ record, targetId });
                verdicts.push(
                    this.verdict(record, decision.action, decision.reason, targetId)
                );
            } catch (error) {
                verdicts.push({
                    ...this.verdict(
                        record,
                        IMPORT_ACTION.Error,
                        IMPORT_REASON.ValidationFailed
                    ),
                    issues: [messageOf(error)]
                });
            }
            countVerdict(counts, verdicts[verdicts.length - 1]);
        }

        // Second pass: every row now exists, so links can be applied — and the
        // unresolved ones reported rather than silently dropped.
        await this.applyLinks(linkPass, ids, verdicts, command);
        this.reportUnresolved(document.records, ids, verdicts, command.dryRun);

        return {
            version: document.manifest.version,
            counts,
            verdicts,
            hasChanges: hasChanges(counts)
        };
    }

    /**
     * Which fields identify this type, preferring what the **exporter** recorded.
     *
     * The manifest's copy is authoritative because it is what the exporter keyed
     * on. Re-deriving locally would silently move the matching target whenever
     * the schema has drifted since the export — and "the same records imported
     * twice" is exactly the failure that produces.
     */
    private identityFor(
        document: TransferDocument,
        typeName: string
    ): readonly string[] {
        const declared = document.manifest.identity?.[typeName];
        if (declared && declared.length > 0) return declared;
        return this.catalog.identityFieldsOf(typeName);
    }

    /** What to do with one record, given whether it matched and the policy. */
    private decide(
        keyable: boolean,
        match: Match | undefined,
        policy: ConflictPolicy
    ): { action: ImportVerdict['action']; reason: ImportReason } {
        if (!match) {
            return {
                action: IMPORT_ACTION.Create,
                reason: keyable ? IMPORT_REASON.New : IMPORT_REASON.NoIdentity
            };
        }
        switch (policy) {
            case CONFLICT_POLICY.Update:
                return {
                    action: IMPORT_ACTION.Update,
                    reason: IMPORT_REASON.Matched
                };
            case CONFLICT_POLICY.Duplicate:
                return {
                    action: IMPORT_ACTION.Create,
                    reason: IMPORT_REASON.ConflictDuplicated
                };
            case CONFLICT_POLICY.Fail:
                return {
                    action: IMPORT_ACTION.Error,
                    reason: IMPORT_REASON.Matched
                };
            default:
                return {
                    action: IMPORT_ACTION.Skip,
                    reason: IMPORT_REASON.ConflictSkipped
                };
        }
    }

    /**
     * Matches every record against existing rows, one batched query per type.
     *
     * Per-record lookups would be an N+1 over a file that may hold thousands of
     * rows; this reads each type's candidate rows once, keyed on the identity
     * columns, and matches in memory.
     */
    private async matchAll(
        records: readonly TransferRecord[],
        workspaceId: string
    ): Promise<Map<string, Match>> {
        const out = new Map<string, Match>();
        const byType = new Map<string, TransferRecord[]>();
        for (const record of records) {
            const bucket = byType.get(record.$type);
            if (bucket) bucket.push(record);
            else byType.set(record.$type, [record]);
        }

        for (const [typeName, typeRecords] of byType) {
            const type = this.registry.get(typeName);
            const identity = this.catalog.identityFieldsOf(typeName);
            if (!type || identity.length === 0) continue;

            // Narrower than `AnyColumn` because the select builder needs it.
            const columns = type.table as unknown as Record<string, PgColumn>;
            // Only the columns the key is made of are readable as a match, and
            // only if they exist — a configured identity naming a dropped field
            // should match nothing rather than throw.
            const usable = identity.filter((field) => !!columns[field]);
            if (usable.length !== identity.length) continue;

            const wanted = new Set(
                typeRecords
                    .map((record) =>
                        keyFingerprint(
                            typeName,
                            naturalKeyOf(identity, record.values)
                        )
                    )
                    .filter((fingerprint) => fingerprint.includes(' '))
            );
            if (wanted.size === 0) continue;

            const projection: Record<string, PgColumn> = { id: columns['id'] };
            for (const field of usable) projection[field] = columns[field];

            // Narrowed by the first key column's values, so a large collection
            // is not read whole to match a twenty-row file.
            const lead = usable[0];
            const leadValues = [
                ...new Set(
                    typeRecords
                        .map((record) => record.values[lead])
                        .filter(
                            (value): value is string | number =>
                                typeof value === 'string' ||
                                typeof value === 'number'
                        )
                )
            ];
            if (leadValues.length === 0) continue;

            const where: SQL | undefined = and(
                eq(columns['workspaceId'], workspaceId),
                inArray(columns[lead], leadValues),
                type.paranoid ? isNull(columns['deletedAt']) : undefined
            );
            const rows = (await this.db
                .select(projection)
                .from(type.table)
                .where(where)) as Record<string, unknown>[];

            for (const row of rows) {
                const fingerprint = keyFingerprint(
                    typeName,
                    naturalKeyOf(identity, row)
                );
                if (!wanted.has(fingerprint) || out.has(fingerprint)) continue;
                out.set(fingerprint, { targetId: row['id'] as string });
            }
        }
        return out;
    }

    /** Creates a row, joining the right translation group when it has siblings. */
    private async create(
        type: AnyContentType,
        record: TransferRecord,
        values: Record<string, unknown>,
        workspaceId: string,
        localeGroups: Map<string, string>,
        actor?: EventActor | null
    ): Promise<string> {
        // The i18n plugin validates the locale and the group id behind
        // content's extension port — transfer passes them through and stays out
        // of it, which is why this package has no dependency on i18n at all.
        const sourceGroup = record.$localeGroup;
        const targetGroup = sourceGroup
            ? localeGroups.get(sourceGroup)
            : undefined;

        const created = await this.writer.create(
            type,
            values,
            workspaceId,
            undefined,
            record.$locale,
            targetGroup,
            actor ?? null
        );

        // The first sibling of a group creates it; the rest join what it made.
        if (sourceGroup && !targetGroup && created.localeGroupId) {
            localeGroups.set(sourceGroup, created.localeGroupId);
        }
        return created.id;
    }

    private async update(
        type: AnyContentType,
        targetId: string,
        values: Record<string, unknown>,
        workspaceId: string,
        actor?: EventActor | null
    ): Promise<string> {
        const updated = await this.writer.update(
            type,
            targetId,
            values,
            workspaceId,
            undefined,
            actor ?? null
        );
        return updated.id;
    }

    /**
     * The second pass: turn each record's references into real links.
     *
     * Written as a plain update carrying only the relation fields, so it goes
     * through the same writer — and therefore the same target checks and
     * same-locale rule — as any other save. A reference that resolved to
     * nothing is dropped from the payload and reported on the record's verdict;
     * refusing the record for a missing neighbour would fail a whole import
     * over one link.
     */
    private async applyLinks(
        pass: readonly { record: TransferRecord; targetId: string }[],
        ids: TransferIdMap,
        verdicts: ImportVerdict[],
        command: ImportCommand
    ): Promise<void> {
        if (command.dryRun) return;

        for (const { record, targetId } of pass) {
            const type = this.registry.get(record.$type);
            if (!type) continue;

            const values: Record<string, unknown> = {};
            const unresolved: string[] = [];
            let any = false;

            for (const [field, value] of Object.entries(record.relations)) {
                if (value === undefined) continue;
                if (value === null) {
                    values[field] = null;
                    any = true;
                    continue;
                }
                const refs = Array.isArray(value) ? value : [value];
                const resolved: string[] = [];
                for (const ref of refs) {
                    const found = ids.resolve(ref);
                    if (found.targetId) resolved.push(found.targetId);
                    else unresolved.push(describeRef(ref));
                }
                values[field] = Array.isArray(value)
                    ? resolved
                    : (resolved[0] ?? null);
                any = true;
            }

            if (any) {
                try {
                    await this.writer.update(
                        type,
                        targetId,
                        values,
                        command.workspaceId,
                        undefined,
                        command.actor ?? null
                    );
                } catch (error) {
                    unresolved.push(messageOf(error));
                }
            }
            if (unresolved.length > 0) {
                const verdict = verdicts.find(
                    (item) =>
                        item.$type === record.$type && item.$id === record.$id
                );
                if (verdict) verdict.unresolved = unresolved;
            }
        }
    }

    /** On a dry run, report which references would not resolve. */
    private reportUnresolved(
        records: readonly TransferRecord[],
        ids: TransferIdMap,
        verdicts: ImportVerdict[],
        dryRun: boolean
    ): void {
        if (!dryRun) return;
        // In a dry run nothing was written, so a reference resolves only if its
        // target already exists or is itself in the document. Both are known.
        const inDocument = new Set(
            records.map((record) => keyFingerprint(record.$type, record.$key))
        );
        for (const record of records) {
            const unresolved: string[] = [];
            for (const value of Object.values(record.relations)) {
                const refs =
                    value == null ? [] : Array.isArray(value) ? value : [value];
                for (const ref of refs) {
                    const known =
                        ids.resolve(ref).targetId !== undefined ||
                        inDocument.has(keyFingerprint(ref.$type, ref.$key));
                    if (!known) unresolved.push(describeRef(ref));
                }
            }
            if (unresolved.length === 0) continue;
            const verdict = verdicts.find(
                (item) => item.$type === record.$type && item.$id === record.$id
            );
            if (verdict) verdict.unresolved = unresolved;
        }
    }

    /** Replaces a record's media references with target asset ids. */
    private async resolveMedia(
        record: TransferRecord,
        schema: { fields: readonly { name: string; type: string; multiple?: boolean }[] },
        command: ImportCommand,
        assets: TransferAssetMap,
        counts: ImportCounts,
        mediaRun: ImportMediaRun
    ): Promise<Record<string, unknown>> {
        const values = { ...record.values };
        if (record.media.length === 0) return values;

        const byField = new Map<string, string[]>();
        for (const ref of record.media) {
            const targetId = await this.media.resolveAsset(
                ref,
                command.assets,
                assets,
                command.workspaceId,
                command.dryRun,
                command.actor ?? null,
                counts,
                mediaRun
            );
            if (!targetId) continue;
            const bucket = byField.get(ref.field) ?? [];
            bucket.push(targetId);
            byField.set(ref.field, bucket);
        }

        for (const field of schema.fields) {
            if (field.type !== 'media') continue;
            const resolved = byField.get(field.name);
            if (!resolved) continue;
            values[field.name] = field.multiple ? resolved : resolved[0];
        }
        return values;
    }

    private verdict(
        record: TransferRecord,
        action: ImportVerdict['action'],
        reason: ImportReason,
        targetId?: string
    ): ImportVerdict {
        return {
            $type: record.$type,
            $id: record.$id,
            label: labelOf(record),
            ...(record.$locale ? { locale: record.$locale } : {}),
            action,
            reason,
            ...(targetId ? { targetId } : {})
        };
    }
}

/** Names a record the way an editor would recognise it. */
function labelOf(record: TransferRecord): string {
    const keyValue = Object.values(record.$key)[0];
    if (keyValue) return keyValue;
    const firstText = Object.values(record.values).find(
        (value) => typeof value === 'string' && value.trim() !== ''
    );
    return typeof firstText === 'string' ? firstText : record.$id;
}

/** `type:key` — how an unresolved reference is reported. */
function describeRef(ref: TransferRef): string {
    const key = Object.values(ref.$key).join('|');
    return `${ref.$type}:${key || (ref.$id ?? '?')}`;
}

/** The message from an unknown throwable, without leaking a stack. */
function messageOf(error: unknown): string {
    if (error instanceof ForbiddenException) return 'Not permitted.';
    if (error instanceof Error) return error.message;
    return 'Write failed.';
}
