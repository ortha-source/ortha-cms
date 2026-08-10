/**
 * The proposal kinds this plugin declares and applies.
 *
 * One constant rather than a string in each tool, because a `kind` is matched
 * **exactly** against `ProposalApplier.kind` and nothing type-checks the pair:
 * a typo in either half produces a proposal that is drafted, approved, written
 * to `copilot_proposals`, and then fails to apply because no applier claims it.
 * Both halves import from here so they cannot drift.
 */
export const MEDIA_PROPOSAL_KINDS = {
    /** Set an asset's alternative text. */
    setAltText: 'media.asset.setAlt',
    /** Author a new text file into the library. */
    createFile: 'media.asset.create'
} as const;
