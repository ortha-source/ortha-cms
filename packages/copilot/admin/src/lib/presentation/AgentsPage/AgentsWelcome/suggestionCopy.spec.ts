import { createIntl } from 'react-intl';
import { inSentence, suggestionCopy } from './suggestionCopy';

const intl = createIntl({ locale: 'en', messages: {} });

const ARTICLES = {
    name: 'article',
    label: 'Articles',
    kind: 'collection' as const,
    owned: true
};

describe('inSentence', () => {
    it('lowers a capitalised word', () => {
        expect(inSentence('Articles')).toBe('articles');
    });

    it('leaves an acronym alone', () => {
        expect(inSentence('SEO pages')).toBe('SEO pages');
        expect(inSentence('FAQ')).toBe('FAQ');
    });

    it('survives an empty label', () => {
        expect(inSentence('')).toBe('');
    });
});

describe('suggestionCopy', () => {
    it('names the workspace’s type in the summary opener', () => {
        expect(
            suggestionCopy(intl, { kind: 'missing-summary', type: ARTICLES })
        ).toEqual({
            title: 'Find articles missing a summary',
            hint: 'and draft one for each',
            prompt: 'Find articles with no summary and draft one for each. Show me the changes before anything is saved.'
        });
    });

    it('names the skill a check runs against', () => {
        const copy = suggestionCopy(intl, {
            kind: 'check-skill',
            type: ARTICLES,
            skill: { name: 'seo-checklist', title: 'SEO checklist' }
        });

        expect(copy.title).toBe('Check recent articles');
        expect(copy.hint).toBe('against the SEO checklist skill');
        expect(copy.prompt).toContain('SEO checklist skill');
    });

    it('keeps a single page’s own name when translating it', () => {
        expect(
            suggestionCopy(intl, {
                kind: 'translate',
                type: {
                    name: 'pricing',
                    label: 'Pricing FAQ',
                    kind: 'single',
                    owned: true
                }
            }).title
        ).toBe('Translate Pricing FAQ');
    });

    it('words the openers that name nothing', () => {
        expect(suggestionCopy(intl, { kind: 'recent-changes' }).title).toBe(
            'What changed this week?'
        );
        expect(suggestionCopy(intl, { kind: 'content-types' }).hint).toBe(
            'content types and what each one holds'
        );
    });
});
