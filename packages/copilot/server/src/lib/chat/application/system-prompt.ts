import { UNTRUSTED_DATA_RULE } from '@ortha-cms/copilot-domain';

/**
 * The surface a run was started from, plus whatever the client knows about
 * where the user is. Everything is optional: the chat panel knows only the
 * workspace, while the entry editor knows the type and the entry.
 */
export interface SurfaceContext {
    /** Where the run started: `chat`, `palette`, `entry`, `records`. */
    surface?: string;
    /** The content type in view, if any. */
    contentType?: string;
    /** The entry in view, if any. */
    entryId?: string;
    /** The content locale in view, if any. */
    locale?: string;
}

/** Everything the prompt is assembled from. */
export interface SystemPromptInput {
    /** The admin UI's locale — the language the answer should be written in. */
    uiLocale: string;
    /** Where the user is, as the client reported it. */
    context: SurfaceContext;
    /** Content-type summaries for this workspace: `name — label (kind)`. */
    typeSummaries: readonly string[];
    /** Whether any tools are on offer this run. */
    hasTools: boolean;
    /**
     * Whether any of them can propose a change. Drives whether the prompt
     * spends words on the approval flow — a viewer's run has no write tools, so
     * telling them about proposals would only invite offers it must then refuse.
     */
    hasWriteTools?: boolean;
}

/**
 * The prompt version, bumped whenever the text below changes.
 *
 * Prompts are product surface: recording the version on a run is what makes a
 * prompt edit reviewable like code and lets a regression be traced to one
 * (`docs/design/copilot.md` §8, "Prompt versioning & evals"). The offline eval
 * set that gives this number teeth is phase 4 work; the number costs nothing
 * now and is impossible to backfill later.
 */
export const SYSTEM_PROMPT_VERSION = 3;

/** How many type summaries the prompt may carry before it is truncated. */
const MAX_TYPE_SUMMARIES = 50;

/**
 * Builds the system prompt.
 *
 * **Type *summaries*, never full field schemas** — the open question in
 * `docs/design/copilot.md` §10, resolved the way that document proposes. A
 * workspace with fifty content types would blow the context budget if every
 * field were inlined; the model fetches the full schema on demand through
 * `admin_content_types`, costing one extra round trip with a bounded worst case.
 *
 * Content bodies never appear here. They arrive only through tool results,
 * fenced as untrusted data.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
    const sections: string[] = [
        // The model introduces itself by the **product** name, not the package
        // name. Bump SYSTEM_PROMPT_VERSION with any change to this text.
        'You are Ortha AI, the assistant built into the Ortha CMS admin. ' +
            'You help the signed-in person find and understand the content they ' +
            'already have access to. If asked what you are, say you are Ortha AI.',

        // The authority model, stated to the model as well as enforced around
        // it. The enforcement is what holds; saying it out loud stops the model
        // wasting turns proposing things it will not be allowed to do.
        'AUTHORITY\n' +
            '- You act as the signed-in user and have exactly their permissions, never more.\n' +
            '- You can only reach the workspace they currently have open.\n' +
            '- If a task needs a tool you have not been given, say so plainly and stop. ' +
            'Do not guess at data you cannot read, and never claim to have done something you did not do.',

        `SECURITY\n- ${UNTRUSTED_DATA_RULE}`,

        'ANSWERING\n' +
            '- Prefer calling a tool over guessing. Facts about content must come from a tool result.\n' +
            '- Cite entries by their title and id so the person can find them.\n' +
            '- Be concise. Answer in Markdown.\n' +
            `- Write your reply in the language of the admin UI locale "${input.uiLocale}", ` +
            'regardless of the language of the content you read.'
    ];

    if (input.hasWriteTools) {
        // The one failure mode worth spending prompt on: a model that treats a
        // proposal tool as a save will report "done", and the person will
        // believe it. Everything below is stated because the tool result alone
        // has been observed not to be enough.
        sections.push(
            'MAKING CHANGES\n' +
                '- Any tool whose name starts with "propose" DRAFTS a change for the person ' +
                'to approve. It does not save anything.\n' +
                '- After calling one, tell them what you have drafted and that it is waiting ' +
                'for their approval. Never say a change has been made, saved, created or ' +
                'published — you cannot do any of those.\n' +
                '- Propose a change once. If the tool result says the draft is awaiting ' +
                'approval, that worked; calling it again just creates a duplicate for them ' +
                'to reject.\n' +
                '- Read before you write. Fetch the entry first so you change what actually ' +
                'needs changing and leave the rest alone.\n' +
                '- You cannot publish. If asked to, draft the change and say a person has to ' +
                'publish it.'
        );
    }

    if (!input.hasTools) {
        sections.push(
            'TOOLS\n- You have no tools available in this run. Answer from the ' +
                'conversation alone, and say clearly that you cannot look anything up.'
        );
    }

    sections.push(describeTypes(input.typeSummaries));

    const where = describeContext(input.context);
    if (where) {
        sections.push(where);
    }

    return sections.join('\n\n');
}

/** The workspace's content types, as a bounded summary list. */
function describeTypes(summaries: readonly string[]): string {
    if (summaries.length === 0) {
        return 'CONTENT TYPES\n- This workspace has no content types available to you.';
    }

    const shown = summaries.slice(0, MAX_TYPE_SUMMARIES);
    const lines = shown.map((summary) => `- ${summary}`).join('\n');
    // Truncation is stated rather than silent: a model told it has the whole
    // list would confidently answer "there is no such type" about one that was
    // cut off.
    const note =
        summaries.length > shown.length
            ? `\n- (${summaries.length - shown.length} more not listed — use admin_content_types to see them all.)`
            : '';

    return (
        'CONTENT TYPES\n' +
        'These are the types in the open workspace, as `name — label (kind)`. ' +
        'Field schemas are NOT listed here; call admin_content_types for a type’s fields.\n' +
        lines +
        note
    );
}

/** Where the user is, when the client reported anything. */
function describeContext(context: SurfaceContext): string | null {
    const lines: string[] = [];
    if (context.surface) lines.push(`- Surface: ${context.surface}`);
    if (context.contentType)
        lines.push(`- Content type in view: ${context.contentType}`);
    if (context.entryId) lines.push(`- Entry in view: ${context.entryId}`);
    if (context.locale) lines.push(`- Locale in view: ${context.locale}`);

    if (lines.length === 0) {
        return null;
    }
    return (
        'WHERE THE USER IS\n' +
        'Use this to resolve vague references like "this entry" or "here".\n' +
        lines.join('\n')
    );
}
