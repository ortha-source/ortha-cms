import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
    diffDocuments,
    type SchemaChange,
    type SchemaDocument
} from '@orthacms/schema-builder-domain';
import type { SchemaIssue } from '@orthacms/content-domain';
import { draftIssues } from '../../domain/draftIssues';
import { schemaDraft } from '../../domain/schemaDraft';
import type { SchemaDraftAction } from '../../domain/schemaDraftAction';

/** The draft and everything derived from it, for one loaded document. */
export type SchemaDraftState = {
    /** The document as the person has edited it. */
    readonly document: SchemaDocument;
    /** The served document the draft started from. */
    readonly base: SchemaDocument;
    readonly dispatch: (action: SchemaDraftAction) => void;
    /** Puts the draft back to the served document. */
    readonly discard: () => void;
    /** What differs from the served document, in the diff's words. */
    readonly changes: readonly SchemaChange[];
    /** Every schema-rule issue the draft has. */
    readonly issues: readonly SchemaIssue[];
    /** The types any change touches — the rail marks them. */
    readonly dirtyTypes: ReadonlySet<string>;
};

/**
 * The editor's state: a reducer over the served document. When a new document
 * is served, or the same one by a new process (a restart landed — the query
 * cache keeps an equal document's identity), the draft starts over from it.
 */
export function useSchemaDraft(
    base: SchemaDocument,
    bootId?: string
): SchemaDraftState {
    const [document, dispatch] = useReducer(schemaDraft, base);
    useEffect(
        () => dispatch({ type: 'reset', document: base }),
        [base, bootId]
    );
    const discard = useCallback(
        () => dispatch({ type: 'reset', document: base }),
        [base]
    );
    const changes = useMemo(
        () => diffDocuments(base, document),
        [base, document]
    );
    const issues = useMemo(() => draftIssues(document), [document]);
    const dirtyTypes = useMemo(
        () => new Set(changes.map((change) => change.type)),
        [changes]
    );
    return { document, base, dispatch, discard, changes, issues, dirtyTypes };
}
