import { humanizeToolName, toolPhrase } from './labels';

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
