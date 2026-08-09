/**
 * The proposal kinds this plugin declares and applies.
 *
 * Named once here rather than spelled as literals in the tool and again in the
 * applier: the two halves are in different files and a typo between them
 * produces a proposal nothing can carry out — which surfaces only when a human
 * clicks Accept, long after the mistake.
 *
 * They are namespaced like tool names for the same reason MCP tools are
 * (ADR-0005 §8): the registry refuses a duplicate `kind`, so a flat name like
 * `update` would be a collision waiting for the second plugin that wants it.
 */
export const CONTENT_PROPOSAL_KINDS = {
    /** A new draft entry of a content type. */
    createEntry: 'content.entry.create',
    /** A change to an existing entry's field values. */
    updateEntry: 'content.entry.update'
} as const;
