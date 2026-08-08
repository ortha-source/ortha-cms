/**
 * Where a proposal's change lands. Opaque to the copilot and meaningful only to
 * the applier that declared the matching {@link ProposalDraft.kind} — content
 * puts a type name and entry id here, media an asset id.
 *
 * Deliberately untyped beyond "a JSON object": the copilot must not learn the
 * shape of every plugin's addressing, or it becomes the thing that has to
 * change whenever one of them does.
 */
export type ProposalTarget = Readonly<Record<string, unknown>>;

/** One field's before/after, for the diff a human reviews. */
export interface ProposalChange {
    /** The field's name, as the content type declares it. */
    field: string;
    /** A human label for the field, when the schema has one. */
    label?: string;
    /** The value today. Absent on a create — there is nothing to replace. */
    before?: unknown;
    /** The value the proposal would write. */
    after: unknown;
}

/**
 * What a `propose` tool returns: a change described well enough for a human to
 * decide on, and for an applier to carry out.
 *
 * **The tool does not write it.** A propose tool computes the change and hands
 * it back; the run engine persists it as a `copilot_proposals` row and, if the
 * workspace opted this tool into auto-apply, immediately accepts it. That split
 * is what keeps [ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md)
 * §5's guarantees in one place instead of once per binder — every proposal is
 * recorded, whether or not a human clicks, so an auto-applied change is
 * "undoable, never invisible" rather than a write with no paper trail.
 */
export interface ProposalDraft {
    /**
     * Which applier carries this out — namespaced like a tool name, e.g.
     * `content.entry.update`. Matched exactly against
     * {@link ProposalApplier.kind}.
     */
    kind: string;
    /** Where the change lands. */
    target: ProposalTarget;
    /** The change itself, in whatever shape the applier's use-case takes. */
    patch: Readonly<Record<string, unknown>>;
    /** One line naming the change — the card's title and the model's receipt. */
    summary: string;
    /**
     * Per-field before/after for the review UI. Optional because not every
     * change is field-shaped, but supply it whenever it is: a diff is the whole
     * reason a human can decide in a second rather than a minute.
     */
    changes?: readonly ProposalChange[];
}

/**
 * Whether a proposal is still awaiting a decision, and which one it got.
 *
 * There is no `applied` state distinct from `accepted`: accepting *is*
 * applying — the use-case runs inside the accept, and a failure leaves the
 * proposal `pending` with its error recorded, so a transient failure can be
 * retried rather than stranding the row in a fourth state nobody clears.
 */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Runtime guard for a value a `propose` tool returned.
 *
 * The engine trusts `effect: 'propose'` to mean "this returns a draft", and a
 * binder that gets it wrong would otherwise write a malformed row into an
 * append-only table. Checking here turns that into an ordinary tool error the
 * model can report, which is the same treatment every other binder bug gets.
 */
export function isProposalDraft(value: unknown): value is ProposalDraft {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Partial<ProposalDraft>;
    return (
        typeof draft.kind === 'string' &&
        draft.kind.length > 0 &&
        typeof draft.summary === 'string' &&
        !!draft.target &&
        typeof draft.target === 'object' &&
        !!draft.patch &&
        typeof draft.patch === 'object'
    );
}
