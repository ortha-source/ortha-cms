import type { ClassifiedChange } from '../classify/classified-change';

/** One file an apply would write under `src/content/`, before and after. */
export interface StagedFile {
    /** Path under `src/content/` (`collections/event.ts`, `index.ts`). */
    readonly path: string;
    /** Today's contents; `null` for a new file. */
    readonly before: string | null;
    /** The contents an apply writes; `null` for a file it deletes. */
    readonly after: string | null;
}

/** What `POST /schema-builder/plan` answers: what an apply of the draft would do. */
export interface SchemaPlan {
    /** The fingerprint the plan was made against; an apply must send it back. */
    readonly baseFingerprint: string;
    /** Every change with its verdict, in the diff's order. */
    readonly changes: readonly ClassifiedChange[];
    /** True when any change is blocked; files and SQL are then left empty. */
    readonly blocked: boolean;
    /** The files an apply would write or delete, unchanged ones left out. */
    readonly files: readonly StagedFile[];
    /** The migration SQL, one entry per generated migration (removals first). */
    readonly sql: readonly string[];
}
