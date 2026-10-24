import { defineMessages, type IntlShape } from 'react-intl';
import type { CopilotSuggestion } from '../../../application/useCopilotSuggestions';

const messages = defineMessages({
    missingSummaryTitle: {
        id: 'copilot.agents.suggestion.missingSummary.title',
        defaultMessage: 'Find {type} missing a summary'
    },
    missingSummaryHint: {
        id: 'copilot.agents.suggestion.missingSummary.hint',
        defaultMessage: 'and draft one for each'
    },
    missingSummaryPrompt: {
        id: 'copilot.agents.suggestion.missingSummary.prompt',
        defaultMessage:
            'Find {type} with no summary and draft one for each. Show me the changes before anything is saved.'
    },
    recentTitle: {
        id: 'copilot.agents.suggestion.recent.title',
        defaultMessage: 'What changed this week?'
    },
    recentHint: {
        id: 'copilot.agents.suggestion.recent.hint',
        defaultMessage: 'publishes, drafts and who did them'
    },
    recentPrompt: {
        id: 'copilot.agents.suggestion.recent.prompt',
        defaultMessage:
            'What changed in this workspace this week? List the publishes and drafts, and who made them.'
    },
    translateTitle: {
        id: 'copilot.agents.suggestion.translate.title',
        defaultMessage: 'Translate {type}'
    },
    translateHint: {
        id: 'copilot.agents.suggestion.translate.hint',
        defaultMessage: 'into another language, as a draft'
    },
    translatePrompt: {
        id: 'copilot.agents.suggestion.translate.prompt',
        defaultMessage:
            'Translate {type} into another language as a draft. Ask me which record and which language first.'
    },
    checkTitle: {
        id: 'copilot.agents.suggestion.check.title',
        defaultMessage: 'Check recent {type}'
    },
    checkHint: {
        id: 'copilot.agents.suggestion.check.hint',
        defaultMessage: 'against the {skill} skill'
    },
    checkPrompt: {
        id: 'copilot.agents.suggestion.check.prompt',
        defaultMessage:
            'Check the most recently edited {type} against the {skill} skill and tell me what needs fixing.'
    },
    draftTitle: {
        id: 'copilot.agents.suggestion.draft.title',
        defaultMessage: 'Draft a new record in {type}'
    },
    draftHint: {
        id: 'copilot.agents.suggestion.draft.hint',
        defaultMessage: 'and show me the change before it saves'
    },
    draftPrompt: {
        id: 'copilot.agents.suggestion.draft.prompt',
        defaultMessage:
            'Draft a new record in {type}. Ask me what it should be about, and show me the change before it saves.'
    },
    typesTitle: {
        id: 'copilot.agents.suggestion.types.title',
        defaultMessage: 'What can I work with here?'
    },
    typesHint: {
        id: 'copilot.agents.suggestion.types.hint',
        defaultMessage: 'content types and what each one holds'
    },
    typesPrompt: {
        id: 'copilot.agents.suggestion.types.prompt',
        defaultMessage:
            'What content types can I work with in this workspace, and what does each one hold?'
    }
});

/** What one suggestion card shows, and what picking it sends. */
export interface SuggestionCopy {
    /** The card's first line. */
    title: string;
    /** Its quieter second line. */
    hint: string;
    /** The message sent as the first turn. */
    prompt: string;
}

/**
 * A type's label as it reads mid-sentence: "Articles" becomes "articles", so
 * the opener reads "Find articles missing a summary". Only a capitalised
 * *word* is lowered — "SEO pages" and "FAQ" keep their capitals, because
 * lowering an acronym's first letter produces "sEO".
 */
export function inSentence(label: string, locale = 'en'): string {
    const [first, second] = label;
    if (!first || (second && second !== second.toLocaleLowerCase(locale))) {
        return label;
    }
    return first.toLocaleLowerCase(locale) + label.slice(1);
}

/**
 * The words for one opener.
 *
 * Pure over an `IntlShape`, so every kind is a unit test rather than a
 * rendered card. The server picks the openers and the admin words them — a
 * suggestion's wire shape names a type and a skill, never a sentence.
 */
export function suggestionCopy(
    intl: IntlShape,
    suggestion: CopilotSuggestion
): SuggestionCopy {
    const say = (
        title: keyof typeof messages,
        hint: keyof typeof messages,
        prompt: keyof typeof messages,
        values: Record<string, string> = {}
    ): SuggestionCopy => ({
        title: intl.formatMessage(messages[title], values),
        hint: intl.formatMessage(messages[hint], values),
        prompt: intl.formatMessage(messages[prompt], values)
    });

    switch (suggestion.kind) {
        case 'missing-summary':
            return say(
                'missingSummaryTitle',
                'missingSummaryHint',
                'missingSummaryPrompt',
                { type: inSentence(suggestion.type.label, intl.locale) }
            );
        case 'recent-changes':
            return say('recentTitle', 'recentHint', 'recentPrompt');
        case 'translate':
            return say('translateTitle', 'translateHint', 'translatePrompt', {
                type:
                    suggestion.type.kind === 'single'
                        ? suggestion.type.label
                        : inSentence(suggestion.type.label, intl.locale)
            });
        case 'check-skill':
            return say('checkTitle', 'checkHint', 'checkPrompt', {
                type: inSentence(suggestion.type.label, intl.locale),
                skill: suggestion.skill.title
            });
        case 'draft-new':
            return say('draftTitle', 'draftHint', 'draftPrompt', {
                type: suggestion.type.label
            });
        case 'content-types':
            return say('typesTitle', 'typesHint', 'typesPrompt');
    }
}
