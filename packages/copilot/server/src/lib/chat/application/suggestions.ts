/**
 * A content type the open workspace can reach, as the suggestions read it.
 */
export interface SuggestionContentType {
    /** Machine name, e.g. `article`. */
    name: string;
    /** What a person calls it, e.g. `Articles`. */
    label: string;
    /** A collection of records, or a single page. */
    kind: 'collection' | 'single';
    /** True for the workspace's own grant; false for shared records only. */
    owned: boolean;
}

/** A skill as the suggestions read it — only enabled ones are passed in. */
export interface SuggestionSkill {
    name: string;
    title: string;
    mode: 'manual' | 'always';
}

/**
 * One opener on the new-chat page.
 *
 * **Structured, never prose.** The server decides *which* openers make sense
 * for this workspace and this person; the admin words them, so they translate
 * with the rest of the UI instead of arriving as English from an endpoint.
 * Each kind maps to a tool the caller is actually offered — a suggestion is a
 * promise about what the assistant can do, and one that lands on "I can't do
 * that" is worse than no suggestion.
 */
export type CopilotSuggestion =
    /** "Find {type} missing a summary — and draft one for each." */
    | { kind: 'missing-summary'; type: SuggestionContentType }
    /** "What changed this week? — publishes, drafts and who did them." */
    | { kind: 'recent-changes' }
    /** "Translate a {type} record — into another language, as a draft." */
    | { kind: 'translate'; type: SuggestionContentType }
    /** "Check recent {type} — against the {skill} skill." */
    | {
          kind: 'check-skill';
          type: SuggestionContentType;
          skill: { name: string; title: string };
      }
    /** "Draft a new {type} — and show me the change before it saves." */
    | { kind: 'draft-new'; type: SuggestionContentType }
    /** "What can I work with here? — content types and what each holds." */
    | { kind: 'content-types' };

/** How many openers the page shows. */
export const SUGGESTION_COUNT = 4;

/** What {@link buildSuggestions} decides from. */
export interface SuggestionInput {
    /** The types the workspace was granted, in catalogue order. */
    types: readonly SuggestionContentType[];
    /** The workspace's enabled skills. */
    skills: readonly SuggestionSkill[];
    /** The names of the tools this caller is offered here. */
    tools: readonly string[];
}

/**
 * Picks up to {@link SUGGESTION_COUNT} openers for one person in one
 * workspace.
 *
 * Pure, so every rule below is a unit test rather than a fixture:
 *
 * - **Only what the caller can do.** A write opener needs the write tool, a
 *   translation needs the i18n tool, "what changed" needs the activity tool.
 *   A viewer gets reads only.
 * - **Named after this workspace's content.** The first collection the
 *   workspace owns is the one the openers are about — owned, because a
 *   shared grant can be read and linked but never written.
 * - **A skill is offered by name** only when one is turned on and waits to be
 *   switched on per chat; an always-on skill already applies to everything.
 * - **The catalogue opener fills the gaps**, so the page never shows an empty
 *   slot — it needs nothing but the content-type tool every role has.
 */
export function buildSuggestions(input: SuggestionInput): CopilotSuggestion[] {
    const offered = new Set(input.tools);
    const can = (...names: string[]) => names.some((name) => offered.has(name));

    const owned = input.types.filter((type) => type.owned);
    const collection =
        owned.find((type) => type.kind === 'collection') ??
        input.types.find((type) => type.kind === 'collection');
    const writable = owned.find((type) => type.kind === 'collection');
    const anyType = collection ?? input.types[0];
    const manualSkill = input.skills.find((skill) => skill.mode === 'manual');

    const picked: CopilotSuggestion[] = [];
    const add = (suggestion: CopilotSuggestion) => {
        if (picked.length < SUGGESTION_COUNT) picked.push(suggestion);
    };

    if (
        writable &&
        can('content_propose_bulk_save', 'content_propose_update') &&
        can('admin_content_search')
    ) {
        add({ kind: 'missing-summary', type: writable });
    }
    if (can('activity_recent')) {
        add({ kind: 'recent-changes' });
    }
    if (
        anyType &&
        can('i18n_propose_translation', 'i18n_propose_bulk_translation')
    ) {
        add({ kind: 'translate', type: anyType });
    }
    if (collection && manualSkill && can('admin_content_search')) {
        add({
            kind: 'check-skill',
            type: collection,
            skill: { name: manualSkill.name, title: manualSkill.title }
        });
    }
    if (writable && can('content_propose_create')) {
        add({ kind: 'draft-new', type: writable });
    }
    if (!picked.some((suggestion) => suggestion.kind === 'content-types')) {
        add({ kind: 'content-types' });
    }
    return picked;
}
