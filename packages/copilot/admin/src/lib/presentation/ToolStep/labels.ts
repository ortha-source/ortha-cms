import { defineMessages, type MessageDescriptor } from 'react-intl';

/**
 * What each tool is *doing*, and what it *did*.
 *
 * The collapsed step used to read `i18n_translations_get · Running…` — a
 * pending state that technically existed and told nobody anything. A snake_case
 * identifier is the model's name for a thing, not a person's, and the step list
 * is the one part of the transcript a user reads to follow along. Now it reads
 * "Checking translations…" and then "Checked translations · 3 locales", which
 * is a log of what happened rather than a list of function calls.
 *
 * Two tenses per tool, not one string with a spinner beside it: "Searching" and
 * "Searched" are the difference between *is happening* and *happened*, and a
 * run that made six calls should read back as six completed sentences.
 *
 * Keyed by the tool's registered name. A tool with no entry — an MCP connector's
 * `mcp.<connector>.<tool>`, or one added without touching this file — falls back
 * to {@link humanizeToolName}, so a missing entry degrades to something readable
 * rather than to a blank line.
 */
const phrases = defineMessages({
    'admin_content_types.running': {
        id: 'copilot.step.admin_content_types.running',
        defaultMessage: 'Reading content types…'
    },
    'admin_content_types.done': {
        id: 'copilot.step.admin_content_types.done',
        defaultMessage: 'Read content types'
    },
    'admin_content_search.running': {
        id: 'copilot.step.admin_content_search.running',
        defaultMessage: 'Searching content…'
    },
    'admin_content_search.done': {
        id: 'copilot.step.admin_content_search.done',
        defaultMessage: 'Searched content'
    },
    'admin_content_get.running': {
        id: 'copilot.step.admin_content_get.running',
        defaultMessage: 'Opening an entry…'
    },
    'admin_content_get.done': {
        id: 'copilot.step.admin_content_get.done',
        defaultMessage: 'Read an entry'
    },
    'admin_content_revisions.running': {
        id: 'copilot.step.admin_content_revisions.running',
        defaultMessage: 'Reading the revision history…'
    },
    'admin_content_revisions.done': {
        id: 'copilot.step.admin_content_revisions.done',
        defaultMessage: 'Read the revision history'
    },
    'admin_content_diff.running': {
        id: 'copilot.step.admin_content_diff.running',
        defaultMessage: 'Comparing two versions…'
    },
    'admin_content_diff.done': {
        id: 'copilot.step.admin_content_diff.done',
        defaultMessage: 'Compared two versions'
    },
    'i18n_locales_list.running': {
        id: 'copilot.step.i18n_locales_list.running',
        defaultMessage: 'Listing the languages…'
    },
    'i18n_locales_list.done': {
        id: 'copilot.step.i18n_locales_list.done',
        defaultMessage: 'Listed the languages'
    },
    'i18n_translations_get.running': {
        id: 'copilot.step.i18n_translations_get.running',
        defaultMessage: 'Checking translations…'
    },
    'i18n_translations_get.done': {
        id: 'copilot.step.i18n_translations_get.done',
        defaultMessage: 'Checked translations'
    },
    'media_assets_search.running': {
        id: 'copilot.step.media_assets_search.running',
        defaultMessage: 'Searching media…'
    },
    'media_assets_search.done': {
        id: 'copilot.step.media_assets_search.done',
        defaultMessage: 'Searched media'
    },
    'activity_recent.running': {
        id: 'copilot.step.activity_recent.running',
        defaultMessage: 'Reading recent activity…'
    },
    'activity_recent.done': {
        id: 'copilot.step.activity_recent.done',
        defaultMessage: 'Read recent activity'
    },
    'workspace_members_list.running': {
        id: 'copilot.step.workspace_members_list.running',
        defaultMessage: 'Listing the workspace’s members…'
    },
    'workspace_members_list.done': {
        id: 'copilot.step.workspace_members_list.done',
        defaultMessage: 'Listed the workspace’s members'
    },
    // The write tools. Past tense on completion because since ADR-0009 the
    // change really has happened by then — "Proposed an entry" would describe a
    // step that no longer exists.
    'content_propose_create.running': {
        id: 'copilot.step.content_propose_create.running',
        defaultMessage: 'Creating an entry…'
    },
    'content_propose_create.done': {
        id: 'copilot.step.content_propose_create.done',
        defaultMessage: 'Created an entry'
    },
    'content_propose_update.running': {
        id: 'copilot.step.content_propose_update.running',
        defaultMessage: 'Updating an entry…'
    },
    'content_propose_update.done': {
        id: 'copilot.step.content_propose_update.done',
        defaultMessage: 'Updated an entry'
    },
    'content_propose_bulk_save.running': {
        id: 'copilot.step.content_propose_bulk_save.running',
        defaultMessage: 'Saving several entries…'
    },
    'content_propose_bulk_save.done': {
        id: 'copilot.step.content_propose_bulk_save.done',
        defaultMessage: 'Saved several entries'
    },
    'i18n_propose_translation.running': {
        id: 'copilot.step.i18n_propose_translation.running',
        defaultMessage: 'Adding a translation…'
    },
    'i18n_propose_translation.done': {
        id: 'copilot.step.i18n_propose_translation.done',
        defaultMessage: 'Added a translation'
    },
    'media_propose_alt_text.running': {
        id: 'copilot.step.media_propose_alt_text.running',
        defaultMessage: 'Setting alt text…'
    },
    'media_propose_alt_text.done': {
        id: 'copilot.step.media_propose_alt_text.done',
        defaultMessage: 'Set alt text'
    }
});

/** The phrase for a tool in one of its two tenses, or `null` if unknown. */
export function toolPhrase(
    name: string,
    tense: 'running' | 'done'
): MessageDescriptor | null {
    return phrases[`${name}.${tense}` as keyof typeof phrases] ?? null;
}

/**
 * A readable-enough label for a tool nobody wrote a phrase for.
 *
 * `mcp.acme.fetch_orders` → `Fetch orders`. The connector prefix goes because
 * it is deployment plumbing rather than something the reader chose, and
 * `mcp.<connector>.<tool>` is a namespace this CMS imposes (ADR-0005 §8), not
 * part of the tool's own name.
 *
 * Deliberately **not** translated: it is derived from an identifier a
 * third-party connector chose, so there is no message to translate — inventing
 * an id per unknown tool would put untranslated English in the catalogue under
 * a key nothing can ever resolve.
 */
export function humanizeToolName(name: string): string {
    const bare = name.startsWith('mcp.')
        ? (name.split('.').at(-1) ?? name)
        : name;
    const words = bare.replace(/[._-]+/g, ' ').trim();
    if (!words) return name;
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Where a subject is looked for in a tool's arguments, **best first**.
 *
 * `summary` leads because every `propose` tool declares one and its schema asks
 * the model to write it *for a person* ("New article: Spring launch") — it is
 * the closest thing on the wire to the sentence a user would have typed. The
 * rest are the fields the shipped read tools actually take, ending at the
 * content type, which is the weakest useful answer ("Searching content ·
 * article" still beats "Searching content").
 *
 * Ids are deliberately absent: `e42` names the thing to the machine and to
 * nobody else, and a line that ends in one is noise wearing the shape of detail.
 */
const SUBJECT_KEYS = [
    'summary',
    'search',
    'query',
    'q',
    'title',
    'name',
    'typeName',
    'contentType',
    'locale'
] as const;

/** How much of a subject is shown before it is cut. */
export const MAX_TOOL_SUBJECT_LENGTH = 72;

/**
 * The **thing** a call is about, taken from its arguments — the difference
 * between "Creating an entry…" and "Creating an entry · German translation of
 * Prescribing Information".
 *
 * The input is model-authored text derived from workspace content, so it is
 * treated as hostile on the way out: control and format characters (which
 * include the bidi overrides that let a string render as something other than
 * what it is) are replaced, every whitespace run collapses to one space, and
 * the result is cut to {@link MAX_TOOL_SUBJECT_LENGTH} **code points** so a cut
 * can never land inside a surrogate pair. Callers render the return value as
 * text; nothing here produces markup.
 *
 * Returns `null` when the arguments carry nothing a person would recognise,
 * which is the common case for a tool that takes only ids — the step then reads
 * exactly as it did before.
 */
export function toolSubject(input: unknown): string | null {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return null;
    }
    const record = input as Record<string, unknown>;
    for (const key of SUBJECT_KEYS) {
        const value = record[key];
        if (typeof value !== 'string') {
            continue;
        }
        const text = value
            .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) {
            continue;
        }
        const characters = Array.from(text);
        return characters.length <= MAX_TOOL_SUBJECT_LENGTH
            ? text
            : `${characters
                  .slice(0, MAX_TOOL_SUBJECT_LENGTH - 1)
                  .join('')
                  .trimEnd()}…`;
    }
    return null;
}
