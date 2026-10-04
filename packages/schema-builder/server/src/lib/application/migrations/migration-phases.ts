import { Inject, Injectable } from '@nestjs/common';
import {
    hasRemovals,
    withoutAdditions,
    type SchemaDocument
} from '@orthacms/schema-builder-domain';
import type { MigrationGenerator } from '../../domain/ports/migration-generator.port';
import { MIGRATION_GENERATOR } from '../../schema-builder.tokens';
import { StageWriter } from '../stage/stage-writer';

/** Where the phases run and what their migrations are called. */
export interface PhasesInput {
    /** The operation's folder; `<work>/content` must already hold the staged draft. */
    readonly work: string;
    readonly current: SchemaDocument;
    readonly draft: SchemaDocument;
    /** The migrations folder to generate into. */
    readonly out: string;
    /** The migration's name; the removals phase appends `_removals`. */
    readonly name: string;
}

/** What the phases generated, removals first. */
export interface PhasesOutput {
    readonly files: string[];
    readonly sql: string[];
}

/**
 * drizzle-kit, twice when something is removed: first a document with the
 * removals only (`withoutAdditions`), then the draft. A diff holding a drop
 * and a create on one table is the one drizzle-kit stops to ask about;
 * split, it never sees one. Plan and apply both generate through here.
 */
@Injectable()
export class MigrationPhases {
    constructor(
        @Inject(MIGRATION_GENERATOR)
        private readonly generator: MigrationGenerator,
        private readonly stage: StageWriter
    ) {}

    async run({
        work,
        current,
        draft,
        out,
        name
    }: PhasesInput): Promise<PhasesOutput> {
        const runs = [];
        if (hasRemovals(current, draft)) {
            await this.stage.write(
                `${work}/removals`,
                current,
                withoutAdditions(current, draft)
            );
            runs.push(
                await this.generator.generate({
                    schema: `${work}/removals/index.ts`,
                    out,
                    name: `${name}_removals`
                })
            );
        }
        runs.push(
            await this.generator.generate({
                schema: `${work}/content/index.ts`,
                out,
                name
            })
        );
        return {
            files: runs.flatMap((run) => run.files),
            sql: runs.map((run) => run.sql).filter((sql) => sql.length > 0)
        };
    }
}
