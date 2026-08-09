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
