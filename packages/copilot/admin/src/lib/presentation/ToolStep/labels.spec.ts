import {
    MAX_TOOL_SUBJECT_LENGTH,
    humanizeToolName,
    toolPhrase,
    toolSubject
} from './labels';

describe('toolPhrase', () => {
    it('has both tenses for every shipped tool', () => {
        // Two tenses, not one: "Searching" and "Searched" are the difference
        // between *is happening* and *happened*, which is the whole point of
        // the step list reading as a log.
        for (const name of [
            'admin_content_types',
            'admin_content_search',
            'admin_content_get',
            'admin_content_revisions',
            'admin_content_diff',
            'i18n_locales_list',
            'i18n_translations_get',
            'media_assets_search',
            'activity_recent',
            'workspace_members_list',
            'content_propose_create',
            'content_propose_update',
            'i18n_propose_translation',
            'media_propose_alt_text'
        ]) {
            expect(toolPhrase(name, 'running')).not.toBeNull();
            expect(toolPhrase(name, 'done')).not.toBeNull();
        }
    });

    it('marks the running tense with an ellipsis and the done tense without', () => {
        expect(
            toolPhrase('admin_content_search', 'running')?.defaultMessage
        ).toBe('Searching content…');
        expect(toolPhrase('admin_content_search', 'done')?.defaultMessage).toBe(
            'Searched content'
        );
    });

    it('returns null for a tool nobody wrote a phrase for', () => {
        expect(toolPhrase('mcp.acme.fetch_orders', 'running')).toBeNull();
    });

    it('does not resolve a key forged out of the tense separator', () => {
        // The lookup is `${name}.${tense}`, so a tool literally named
        // `admin_content_search.done` must not borrow another tool's phrase.
        expect(toolPhrase('admin_content_search.done', 'running')).toBeNull();
    });
});

describe('humanizeToolName', () => {
    it('strips the MCP connector namespace', () => {
        // `mcp.<connector>.<tool>` is a namespace this CMS imposes (ADR-0005
        // §8), not part of the tool's own name, so it is plumbing to a reader.
        expect(humanizeToolName('mcp.acme.fetch_orders')).toBe('Fetch orders');
    });

    it('turns a bare snake_case name into a sentence', () => {
        expect(humanizeToolName('list_open_invoices')).toBe(
            'List open invoices'
        );
    });

    it('handles dots and dashes too', () => {
        expect(humanizeToolName('acme.get-thing')).toBe('Acme get thing');
    });

    it('leaves an already-readable name alone', () => {
        expect(humanizeToolName('Search')).toBe('Search');
    });

    it('falls back to the raw name when there is nothing to humanize', () => {
        expect(humanizeToolName('___')).toBe('___');
        expect(humanizeToolName('')).toBe('');
    });
});

describe('toolSubject', () => {
    it('prefers the summary every propose tool is asked to write for a person', () => {
        expect(
            toolSubject({
                typeName: 'article',
                id: 'e42',
                summary: 'German translation of Prescribing Information'
            })
        ).toBe('German translation of Prescribing Information');
    });

    it('falls back through the keys the read tools actually take', () => {
        expect(toolSubject({ typeName: 'article', search: 'pricing' })).toBe(
            'pricing'
        );
        // No query at all — the content type is weak, and still better than
        // "Searching content" on its own.
        expect(toolSubject({ typeName: 'article' })).toBe('article');
    });

    it('never answers with an id', () => {
        // `e42` names the entry to the machine and to nobody else, so a step
        // ending in one is noise wearing the shape of detail.
        expect(toolSubject({ id: 'e42', assetId: 'as_9' })).toBeNull();
    });

    it('returns null for arguments that carry nothing readable', () => {
        expect(toolSubject(undefined)).toBeNull();
        expect(toolSubject(null)).toBeNull();
        expect(toolSubject('a string')).toBeNull();
        expect(toolSubject(['a', 'list'])).toBeNull();
        expect(toolSubject({})).toBeNull();
        expect(toolSubject({ summary: '   ' })).toBeNull();
        // A non-string under a subject key is skipped, not stringified.
        expect(toolSubject({ summary: 12, search: 'pricing' })).toBe('pricing');
    });

    it('flattens a subject that tries to be more than one line', () => {
        // The value is model-authored text derived from workspace content. A
        // newline in a one-line log entry is the cheapest way to make the step
        // list say something its author did not write.
        expect(toolSubject({ summary: 'Set a\nsummary\n\ton it' })).toBe(
            'Set a summary on it'
        );
    });

    it('strips control and format characters', () => {
        // `‮` is a bidi override: left in, it renders the rest of the line
        // backwards, which is a string claiming to be a different string.
        expect(toolSubject({ summary: 'Delete‮gnihtyreve' })).toBe(
            'Delete gnihtyreve'
        );
    });

    it('truncates a long subject, and says it did', () => {
        const subject = toolSubject({ summary: 'x'.repeat(200) });
        expect(Array.from(subject ?? '')).toHaveLength(MAX_TOOL_SUBJECT_LENGTH);
        expect(subject?.endsWith('…')).toBe(true);
    });

    it('cuts on code points, so a truncation cannot split a character', () => {
        // Slicing a JS string by index lands between the halves of a surrogate
        // pair and produces a lone surrogate — a replacement glyph in the middle
        // of the line, from a value that was perfectly well formed.
        const subject = toolSubject({ summary: '😀'.repeat(200) }) ?? '';
        expect(subject).not.toMatch(/[\uD800-\uDFFF]$/);
        expect(Array.from(subject)).toHaveLength(MAX_TOOL_SUBJECT_LENGTH);
    });
});
