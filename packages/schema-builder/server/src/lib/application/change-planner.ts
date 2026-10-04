import { Inject, Injectable } from '@nestjs/common';
import {
    classify,
    diffDocuments,
    isBlocked,
    needsMigration,
    type ClassifiedChange,
    type SchemaDocument,
    type SchemaDocumentEnvelope
} from '@orthacms/schema-builder-domain';
import type { ContentStats } from '../domain/ports/content-stats.port';
import { CONTENT_STATS } from '../schema-builder.tokens';
import { assertFresh } from './guards/assert-fresh';
import { assertOwned } from './guards/assert-owned';
import { assertValid } from './guards/assert-valid';

/** The verdict on a draft: every change classified, and what that implies. */
export interface ChangePlan {
    readonly changes: readonly ClassifiedChange[];
    readonly blocked: boolean;
    readonly needsMigration: boolean;
}

/**
 * Everything plan and apply both have to decide, in one place, in this order:
 * fresh, valid, owned, then classified against the database's facts.
 */
@Injectable()
export class ChangePlanner {
    constructor(@Inject(CONTENT_STATS) private readonly stats: ContentStats) {}

    async plan(
        current: SchemaDocumentEnvelope,
        draft: SchemaDocument,
        baseFingerprint: string
    ): Promise<ChangePlan> {
        assertFresh(current, baseFingerprint);
        assertValid(draft);
        const diff = diffDocuments(current.document, draft);
        assertOwned(current.document, draft, diff);
        const changes = classify(diff, {
            after: draft,
            facts: await this.stats.facts(diff, draft)
        });
        return {
            changes,
            blocked: isBlocked(changes),
            needsMigration: needsMigration(changes)
        };
    }
}
