import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
    ApplyOperation,
    SchemaDocument
} from '@orthacms/schema-builder-domain';
import { builderPaths } from '../../domain/builder-paths';
import { PublishFailedError, SchemaBuilderError } from '../../domain/errors';
import type { MigrationRunner } from '../../domain/ports/migration-runner.port';
import type { OperationLog } from '../../domain/ports/operation-log.port';
import type { SchemaAudit } from '../../domain/ports/schema-audit.port';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import {
    MIGRATION_RUNNER,
    OPERATION_LOG,
    SCHEMA_AUDIT,
    SCHEMA_BUILDER_CONFIG,
    SOURCE_TREE
} from '../../schema-builder.tokens';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';
import type { ChangePlan } from '../change-planner';
import { MigrationPhases } from '../migrations/migration-phases';
import { StageWriter } from '../stage/stage-writer';
import { applyFolder } from './apply-folder';
import { StagePublisher } from './stage-publisher';

/** Everything one apply needs, decided before it was accepted. */
export interface ApplyJobInput {
    readonly operation: ApplyOperation;
    readonly current: SchemaDocument;
    readonly draft: SchemaDocument;
    readonly plan: ChangePlan;
    readonly migrationName: string;
    readonly actorId: string | null;
    /** Gives the apply lock back; always called. */
    readonly release: () => Promise<void>;
}

/**
 * One apply, after the request was answered. All or nothing (design
 * invariant 3): stage, back up, generate, migrate in one transaction, record,
 * and only then write `src/content/` (invariant 4). A failure before the
 * publish puts the migrations folder back; the database was never touched or
 * its transaction rolled back.
 */
@Injectable()
export class ApplyJob {
    private readonly logger = new Logger(ApplyJob.name);

    constructor(
        @Inject(SOURCE_TREE) private readonly tree: SourceTree,
        @Inject(SCHEMA_BUILDER_CONFIG)
        private readonly config: SchemaBuilderPluginConfig,
        @Inject(OPERATION_LOG) private readonly log: OperationLog,
        @Inject(MIGRATION_RUNNER) private readonly runner: MigrationRunner,
        @Inject(SCHEMA_AUDIT) private readonly audit: SchemaAudit,
        private readonly stage: StageWriter,
        private readonly phases: MigrationPhases,
        private readonly publisher: StagePublisher
    ) {}

    async run(input: ApplyJobInput): Promise<ApplyOperation> {
        const paths = builderPaths(this.config);
        const folder = applyFolder(input.operation.id);
        let operation = input.operation;
        const save = async (patch: Partial<ApplyOperation>) => {
            operation = { ...operation, ...patch };
            await this.log.save(operation);
        };

        try {
            const files = await this.stage.write(
                folder.content,
                input.current,
                input.draft
            );
            await this.tree.copyDir(paths.migrations, folder.backupMigrations);
            await this.tree.copyDir(paths.content, folder.backupContent);

            if (input.plan.needsMigration) {
                const generated = await this.phases.run({
                    work: folder.root,
                    current: input.current,
                    draft: input.draft,
                    out: paths.migrations,
                    name: input.migrationName
                });
                await save({ step: 'migrate', migrations: generated.files });
                await this.runner.run();
            }

            await save({ step: 'publish' });
            await this.record(
                input,
                operation,
                files.map((file) => file.path)
            );
            await this.publisher.publish(files).catch((error: Error) => {
                throw new PublishFailedError(folder.backup, error.message);
            });
            await save({
                status: 'succeeded',
                step: null,
                files: files.map((file) => file.path),
                finishedAt: new Date().toISOString()
            });
            await this.tree.remove(folder.root);
        } catch (error) {
            await this.fail(error as Error, operation, save);
        } finally {
            await input.release();
        }
        return operation;
    }

    /** `schema.applied`, after the commit. A failure here is logged: the schema did change. */
    private async record(
        input: ApplyJobInput,
        operation: ApplyOperation,
        files: string[]
    ): Promise<void> {
        try {
            await this.audit.applied({
                operationId: operation.id,
                actorId: input.actorId,
                changes: input.plan.changes.map((change) => change.id),
                migrations: operation.migrations,
                files
            });
        } catch (error) {
            this.logger.error(
                `Could not record schema.applied for ${operation.id}: ${(error as Error).message}`
            );
        }
    }

    /** Puts the migrations folder back unless the database already moved, then records why. */
    private async fail(
        error: Error,
        operation: ApplyOperation,
        save: (patch: Partial<ApplyOperation>) => Promise<void>
    ) {
        const folder = applyFolder(operation.id);
        const published = error instanceof PublishFailedError;
        if (!published) {
            const migrations = builderPaths(this.config).migrations;
            await this.tree.remove(migrations);
            await this.tree.copyDir(folder.backupMigrations, migrations);
        }
        const code =
            error instanceof SchemaBuilderError
                ? error.code
                : 'schema-builder.apply-failed';
        this.logger.error(
            `Apply ${operation.id} failed at ${operation.step}: ${error.message}`
        );
        await save({
            status: 'failed',
            migrations: published ? operation.migrations : [],
            error: { code, message: error.message },
            finishedAt: new Date().toISOString()
        });
        // A failed publish keeps its backup: the database is ahead of the code.
        if (!published) await this.tree.remove(folder.root);
    }
}
