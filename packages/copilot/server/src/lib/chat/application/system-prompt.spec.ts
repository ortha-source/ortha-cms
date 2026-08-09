import { buildSystemPrompt, type SystemPromptInput } from './system-prompt';

/**
 * The prompt is product surface, and until phase 4's offline eval set exists a
 * prompt edit is otherwise reviewed by reading it
 * (`docs/design/copilot.md` §8). These cases are not an eval — they cannot say
 * whether a model behaves better — but they do pin the **conditional**
 * structure, which is where a prompt regression is silent rather than obvious:
 * a section leaking into a run that must not see it (proposals offered to a
 * viewer, a locale instruction with no locale tool) reads as a perfectly
 * ordinary prompt and only fails at the model.
 */
describe('buildSystemPrompt', () => {
    const base: SystemPromptInput = {
        uiLocale: 'en',
        context: {},
        typeSummaries: ['article — Article (collection)'],
        toolNames: ['admin_content_search']
    };

    const build = (overrides: Partial<SystemPromptInput> = {}) =>
        buildSystemPrompt({ ...base, ...overrides });

    it('always states the product name, the authority model and the content model', () => {
        const prompt = build();

        expect(prompt).toContain('You are Ortha AI');
        expect(prompt).toContain('AUTHORITY');
        expect(prompt).toContain('SECURITY');
        expect(prompt).toContain('HOW ORTHA WORKS');
        expect(prompt).toContain('ANSWERING');
    });

    it('writes the reply language from the UI locale, not the content locale', () => {
        expect(build({ uiLocale: 'de' })).toContain('"de"');
    });

    describe('HOW ORTHA WORKS', () => {
        it('frames an ungranted type as unavailable rather than non-existent', () => {
            expect(build()).toContain('not available in this workspace');
        });

        it('rules out the states Ortha does not have', () => {
            expect(build()).toContain(
                'there is no archived or unpublished state'
            );
        });

        it('says each locale is its own entry', () => {
            expect(build()).toContain('each locale is its own entry');
        });

        // The line tells the model to look slugs up; with no i18n plugin bound
        // there is nothing to look them up in, so the instruction can only
        // produce a failing tool call.
        it('mentions locale slugs only when the locale tool is offered', () => {
            expect(build()).not.toContain('Locale slugs');
            expect(
                build({
                    toolNames: ['admin_content_search', 'i18n_locales_list']
                })
            ).toContain('Locale slugs');
        });
    });

    describe('MAKING CHANGES', () => {
        it('is withheld from a run with no write tools', () => {
            expect(build()).not.toContain('MAKING CHANGES');
        });

        it('explains that proposing is not saving when write tools are offered', () => {
            const prompt = build({ hasWriteTools: true });

            expect(prompt).toContain('MAKING CHANGES');
            expect(prompt).toContain('DRAFTS a change');
            expect(prompt).toContain('You cannot publish');
        });

        // v3 said "any tool whose name starts with propose". Every propose tool
        // is named for its owning plugin first, so the rule matched nothing.
        it('describes the propose tools by a rule that actually matches them', () => {
            const prompt = build({
                toolNames: ['content_propose_update'],
                hasWriteTools: true
            });

            expect(prompt).not.toContain('starts with "propose"');
            expect(prompt).toContain('content_propose_update');
        });
    });

    describe('TOOLS', () => {
        it('tells a run with no tools to say it cannot look anything up', () => {
            const prompt = build({ toolNames: [] });

            expect(prompt).toContain('no tools available in this run');
        });

        it('spends no words on the empty case when tools are offered', () => {
            expect(build()).not.toContain('no tools available in this run');
        });
    });

    describe('CONTENT TYPES', () => {
        it('lists the workspace’s granted types', () => {
            expect(build()).toContain('article — Article (collection)');
        });

        it('says so when the workspace has none', () => {
            expect(build({ typeSummaries: [] })).toContain(
                'no content types available to you'
            );
        });

        // A model told it has the whole list will confidently answer "there is
        // no such type" about one that was cut off.
        it('states the truncation instead of hiding it', () => {
            const summaries = Array.from(
                { length: 55 },
                (_, index) => `type${index} — Type ${index} (collection)`
            );
            const prompt = build({ typeSummaries: summaries });

            expect(prompt).toContain('5 more not listed');
            expect(prompt).not.toContain('type54');
        });
    });

    describe('surface', () => {
        it('omits both surface sections when the client reported nothing', () => {
            expect(build()).not.toContain('WHERE THE USER IS');
            expect(build()).not.toContain('ON THIS SURFACE');
        });

        it('reports what is on screen so vague references resolve', () => {
            const prompt = build({
                context: {
                    surface: 'entry',
                    contentType: 'article',
                    entryId: 'entry-1',
                    locale: 'de'
                }
            });

            expect(prompt).toContain('WHERE THE USER IS');
            expect(prompt).toContain('Content type in view: article');
            expect(prompt).toContain('Entry in view: entry-1');
            expect(prompt).toContain('Locale in view: de');
        });

        it('tells the entry surface to resolve "this" to the open entry', () => {
            expect(build({ context: { surface: 'entry' } })).toContain(
                'ON THIS SURFACE'
            );
        });

        it('tells the palette to answer in a sentence or two', () => {
            expect(build({ context: { surface: 'palette' } })).toContain(
                'no preamble'
            );
        });

        // `chat` is the conversational default the rest of the prompt already
        // describes; a line saying so would only take budget.
        it('adds nothing for the chat surface', () => {
            const prompt = build({ context: { surface: 'chat' } });

            expect(prompt).toContain('Surface: chat');
            expect(prompt).not.toContain('ON THIS SURFACE');
        });

        // The DTO's @IsIn already bounds this; the Map lookup is the second
        // line of defence, and a plain object literal would have resolved
        // `constructor` into the prompt.
        it('ignores a surface that is not a known key', () => {
            expect(
                build({ context: { surface: 'constructor' } })
            ).not.toContain('ON THIS SURFACE');
        });
    });
});
