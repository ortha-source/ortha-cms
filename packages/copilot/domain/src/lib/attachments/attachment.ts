/**
 * A file the user attached to a turn, as the run engine describes it to the
 * model.
 *
 * Deliberately **metadata only**. The bytes are not inlined: a chat that pastes
 * every attached file into the prompt spends the context window on files nobody
 * asked about, and the model already has a tool for reading one when the
 * question actually needs it. What this buys is the thing the tool cannot —
 * knowing the file is *there*, and what it is, without being told to go looking.
 */
export interface AttachmentRef {
    /** The media asset's id — what a read tool takes. */
    assetId: string;
    /** The file's name, as stored. */
    name: string;
    /** Its MIME type. */
    mimeType: string;
    /** The coarse media category: image, video, audio, document, archive. */
    kind: string;
    /** Size in bytes. */
    size: number;
    /**
     * Whether the contents can actually be read back.
     *
     * Resolved by the plugin that owns the file rather than guessed from
     * `mimeType` here, because the answer is that plugin's allowlist and a
     * second copy of it would drift. Telling the model up front is what stops a
     * run spending a step discovering that a PDF cannot be decoded.
     */
    readable: boolean;
}

/**
 * Resolves attached asset ids to what the model is told about them — the
 * **port** the run engine reads attachments through.
 *
 * The same inversion as `ProposalApplier` and for the same reason:
 * `copilot/server` must not import `media/server`, so it cannot know how to
 * look an asset up. It knows only that *something* may be able to, and injects
 * this `@Optional()` — a deployment with no media plugin simply cannot attach
 * files, which is the correct behaviour rather than a boot failure.
 *
 * **Implementations must scope to `workspaceId` and drop what does not match.**
 * The run's workspace is proven by `WorkspaceGuard`; an asset id in the request
 * body is proven by nothing, so an id belonging to another workspace must come
 * back absent rather than resolved. The engine treats a missing id as an error
 * the user sees, so silence here is not a silent failure.
 */
export interface AttachmentResolver {
    /**
     * Resolves the ids that exist in `workspaceId`, in any order. Ids that do
     * not exist — or belong elsewhere — are **omitted**, never fabricated.
     */
    resolve(
        assetIds: readonly string[],
        workspaceId: string
    ): Promise<readonly AttachmentRef[]>;
}

/**
 * DI token the owning plugin binds an {@link AttachmentResolver} to.
 *
 * A single binding rather than a runtime registration list: there is one media
 * library, so unlike `COPILOT_PROPOSAL_APPLIER` there is nothing to merge
 * across independent dynamic modules.
 */
export const COPILOT_ATTACHMENT_RESOLVER = Symbol(
    'COPILOT_ATTACHMENT_RESOLVER'
);
