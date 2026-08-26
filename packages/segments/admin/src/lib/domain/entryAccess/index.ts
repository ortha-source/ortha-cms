import { restrictsAnyone, type AccessRule } from '../types/accessRule';
import type { Assignment } from '../types/accessTarget';

/** One level of the inheritance chain that applies to an entry. */
export type AccessLevel = {
    /** Which level this is. */
    kind: 'workspace' | 'type' | 'entry';
    /** The assignment that put a rule here. */
    assignment: Assignment;
    /** The rule itself, when the rule library has been loaded. */
    rule: AccessRule | null;
};

/** What the entry header's chip and the Access tab both render from. */
export type EntryAccess = {
    /**
     * Whether anything in the chain actually restricts a reader. `false` covers
     * both "no rule anywhere" and "a rule that admits everyone" — the second is
     * a real state somebody cleared, and reporting it as restricted would send
     * an editor looking for a rule that is not doing anything.
     */
    restricted: boolean;
    /**
     * The chain that applies, least specific first: workspace, then the content
     * type, then the entry. Every level contributes — this is not a lookup that
     * stops at the first match, because the kernel merges them.
     */
    levels: AccessLevel[];
    /** The most specific level, which is the one an editor edits. */
    nearest: AccessLevel | null;
    /** The assignment attached to this entry itself, if any. */
    own: AccessLevel | null;
};

/**
 * Resolves what governs one entry, from the workspace's assignment list.
 *
 * Deliberately a **description of the chain**, not a re-implementation of the
 * decision. The server merges the levels and evaluates them; asking the admin
 * to do the same arithmetic would give two implementations that can disagree,
 * and the one an editor is looking at would be the one nobody tested against a
 * reader. So this answers only the questions the UI actually needs — is
 * anything restricting this, which levels contributed, and which one do I edit
 * — and everything else goes through `explain`.
 *
 * An entry with no id (a create form) still resolves: the workspace and type
 * levels apply to it the moment it is saved, which is exactly what the chip
 * should be telling the author *before* they publish.
 */
export function resolveEntryAccess(input: {
    assignments: readonly Assignment[];
    rules: readonly AccessRule[];
    typeSlug: string;
    entryId?: string;
}): EntryAccess {
    const ruleById = new Map(input.rules.map((rule) => [rule.id, rule]));
    const levels: AccessLevel[] = [];

    const push = (kind: AccessLevel['kind'], assignment?: Assignment) => {
        if (!assignment) return;
        levels.push({
            kind,
            assignment,
            rule: ruleById.get(assignment.ruleId) ?? null
        });
    };

    push(
        'workspace',
        input.assignments.find(
            (assignment) => assignment.target.kind === 'workspace'
        )
    );
    push(
        'type',
        input.assignments.find(
            (assignment) =>
                assignment.target.kind === 'type' &&
                assignment.target.typeSlug === input.typeSlug
        )
    );
    push(
        'entry',
        input.entryId
            ? input.assignments.find(
                  (assignment) =>
                      assignment.target.kind === 'entry' &&
                      assignment.target.entryId === input.entryId
              )
            : undefined
    );

    // An unloaded rule counts as restricting. The alternative — treating "I
    // don't know yet" as open — puts an "Open to everyone" chip on an entry
    // that has a rule on it, which is the one direction of this error an editor
    // acts on.
    const restricted = levels.some(
        (level) => level.rule === null || restrictsAnyone(level.rule)
    );

    return {
        restricted,
        levels,
        nearest: levels.at(-1) ?? null,
        own: levels.find((level) => level.kind === 'entry') ?? null
    };
}
