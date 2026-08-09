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
    /**
     * The names of the tools this run was actually offered.
     *
     * Names rather than a count, because a few prompt lines are only true when
     * a particular tool is on offer — a deployment without the i18n plugin has
     * no locale list to look anything up in, and telling the model to consult
     * one produces a tool call that can only fail. Same principle as
     * {@link hasWriteTools}: say a thing only to the runs it applies to.
     */
    toolNames: readonly string[];
    /**
     * Whether any of them can change something. Drives whether the prompt
     * spends words on how writes behave — a viewer's run has no write tools, so
     * telling them would only invite offers it must then refuse.
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
export const SYSTEM_PROMPT_VERSION = 5;

/** How many type summaries the prompt may carry before it is truncated. */
const MAX_TYPE_SUMMARIES = 50;

/**
 * How to behave on the surface the run was opened from.
 *
 * A `Map`, not an object literal, so a surface string that is not a key misses
 * instead of resolving `constructor` or `toString` off `Object.prototype` into
 * the prompt. `RUN_SURFACES` + the strict pipe already bound the input; this is
 * the same defence-in-depth `buildModelRegistry` applies to its provider map.
 *
 * `chat` is deliberately absent: it is the full conversational default the rest
 * of the prompt already describes, and a line saying so would only take budget
 * from the surfaces that genuinely differ.
 */
const SURFACE_GUIDANCE = new Map<string, string>([
    [
        'entry',
        'The person is working on the one entry named above. “This”, “it” and ' +
            '“the entry” mean that entry — resolve them to it instead of searching ' +
            'for candidates. Change only what they asked about and leave every ' +
            'other field alone.'
    ],
    [
        'records',
        'The person is looking at a list of entries of the content type named ' +
            'above. Take a question that names no type to be about that one.'
    ],
    [
        'palette',
        'This came from the command palette: one instruction, not a conversation. ' +
            'Do the single thing asked and reply in a sentence or two — no ' +
            'preamble, no summary of your steps, and no follow-up questions.'
    ]
]);

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

        describeContentModel(input.toolNames),

        'ANSWERING\n' +
            '- Prefer calling a tool over guessing. Facts about content must come from a tool result.\n' +
            '- Cite entries by their title and id so the person can find them.\n' +
            '- State a count from the total a tool reported, never by counting the rows on the ' +
            'one page you happened to read.\n' +
            '- Be concise. Answer in Markdown.\n' +
            `- Write your reply in the language of the admin UI locale "${input.uiLocale}", ` +
            'regardless of the language of the content you read.'
    ];

    if (input.hasWriteTools) {
        // The failure mode this spends prompt on has inverted. It used to be a
        // model reporting "done" when nothing had been saved; since ADR-0009
        // every change *is* saved, so the risk is the opposite — a model
        // hedging ("I've drafted this for your approval") about a write that
        // already happened, or quietly retrying one that failed. Both leave the
        // person with a wrong idea of what their content now says.
        sections.push(
            'MAKING CHANGES\n' +
                // The rule names a tool instead of describing a prefix they do
                // not have. Both v3 and v4 said "starts with propose", and
                // every propose tool is named for its owning plugin first
                // (content_propose_update, i18n_propose_translation) — so the
                // rule matched nothing, and a model taking it literally draws
                // the opposite conclusion to the one intended. Saying "despite
                // the name" is the other half: `propose` now saves, so the tool
                // name argues against the rule and has to be overruled out loud.
                '- Any tool with "propose" in its name — content_propose_update, for ' +
                'example — SAVES the change immediately, despite the name. There is no ' +
                'approval step. Do not tell the person a change is waiting for them — ' +
                'nothing is.\n' +
                '- Say plainly what you changed, in the past tense, and name the entry.\n' +
                '- If the tool result says the change was NOT applied, say so and give the ' +
                'reason. Never describe a failed change as done.\n' +
                '- Make a change once. Calling the tool again saves a second time; if a ' +
                'change failed, fix what the error named rather than repeating the call.\n' +
                '- Read before you write. Fetch the entry first so you change what actually ' +
                'needs changing and leave the rest alone.\n' +
                '- Because these save straight away, prefer the smallest change that does ' +
                'what was asked, and ask first if the request is ambiguous.\n' +
                '- You cannot publish. If asked to, make the change and say a person has to ' +
                'publish it.'
        );
    }

    if (input.toolNames.length === 0) {
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

    const surface = describeSurfaceBehavior(input.context.surface);
    if (surface) {
        sections.push(surface);
    }

    return sections.join('\n\n');
}

/**
 * How Ortha models content — the handful of facts that are true of **every**
 * deployment and that no single tool description can carry.
 *
 * This section exists because the rest of the prompt describes what the
 * assistant may do without ever saying what it is looking at. Each line below
 * is here because getting it wrong produces a confident, wrong answer rather
 * than a tool error: "there is no such article" (when the type is merely
 * ungranted), "it is archived" (no such state), or treating a localized
 * entry's translations as fields on one row. Per-tool mechanics stay in the
 * tool's own `description`, where they arrive in context and cost nothing on a
 * run that never calls it.
 */
function describeContentModel(toolNames: readonly string[]): string {
    const lines = [
        'A workspace is the boundary. It is granted a subset of the deployment’s ' +
            'content types, so a type you cannot see may still exist elsewhere. Say ' +
            'something is “not available in this workspace” rather than that it does ' +
            'not exist.',
        'A publishable entry is either a draft or published — there is no archived ' +
            'or unpublished state. Unpublishing returns an entry to draft.',
        'Every saved change to an entry captures a numbered version, so what ' +
            'changed, when, and by whom are answerable rather than guesses.',
        'On a localized type each locale is its own entry, with its own id, status ' +
            'and version history. The German article is a separate entry from the ' +
            'English one, not a field on it.'
    ];

    // Only true where the i18n plugin is installed: without it there is no
    // locale list to consult, and telling the model to consult one buys a tool
    // call that can only fail.
    if (toolNames.includes('i18n_locales_list')) {
        lines.push(
            'Locale slugs are configured per deployment. Look them up rather than ' +
                'assuming a language has the slug you would expect.'
        );
    }

    return 'HOW ORTHA WORKS\n' + lines.map((line) => `- ${line}`).join('\n');
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

/**
 * How to behave here, as opposed to {@link describeContext}'s *what is on
 * screen*. Kept a separate section because they are separate jobs: the facts
 * above are for resolving references, these lines change the shape of the
 * answer. A surface with nothing distinctive to say — `chat`, or a client that
 * sent none — contributes nothing.
 */
function describeSurfaceBehavior(surface?: string): string | null {
    const guidance = surface ? SURFACE_GUIDANCE.get(surface) : undefined;
    return guidance ? `ON THIS SURFACE\n- ${guidance}` : null;
}
