import type { INestApplication } from '@nestjs/common';
import {
    createFakeProvider,
    type FakeTurn
} from '@ortha-cms/copilot-provider-fake';
import { ConversationRepository } from '@ortha-cms/copilot-server';
import { ToolRegistry, type ToolProvider } from '@ortha-cms/tools-server';
import type {
    ModelCapabilities,
    ModelProvider,
    ModelRequest,
    ModelStreamEvent
} from '@ortha-cms/copilot-domain';

/** Models the harness advertises. Named so a "wrong model" test has a target. */
const MODELS = ['fake-1'] as const;

/**
 * The provider currently backing the harness. Replaced wholesale by
 * {@link scriptCopilot}, because `createFakeProvider` takes its script at
 * construction — deliberately, so a script cannot be mutated mid-run.
 */
let current = createFakeProvider({ models: [...MODELS] });

/**
 * The provider registered with `CopilotPlugin` in `buildTestPlugins`.
 *
 * A **stable delegating facade** rather than the fake itself: the plugin list
 * is built once per spec file, but each test needs its own script, so the
 * object handed to the plugin has to outlive the fake it forwards to. Jest
 * isolates module registries per spec file, so `current` is per-file — one
 * suite can never see another's script or call log.
 */
export const fakeProvider: ModelProvider = {
    models: () => current.models(),
    capabilities: (model?: string): Promise<ModelCapabilities> =>
        current.capabilities(model),
    stream: (
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> => current.stream(request, signal)
};

/**
 * Scripts the turns the model will "produce", one per model call, and clears
 * the previous call log. Call it in each test, before the request.
 *
 * Running past the end of a script **throws** rather than inventing a turn, so
 * a test that triggers one model call more than it scripted fails loudly
 * instead of passing against a fabricated answer.
 */
export function scriptCopilot(...turns: FakeTurn[]): void {
    current = createFakeProvider({ script: turns, models: [...MODELS] });
}

/**
 * Every `ModelRequest` served since the last {@link scriptCopilot}.
 *
 * This is the assertion target for the negative path ADR-0005 makes mandatory:
 * *a viewer's run must be verified not to be offered write tools.* That is an
 * assertion about `copilotCalls()[0].tools` — made without a model, and true of
 * the offer itself rather than of what the model happened to do with it.
 */
export function copilotCalls(): readonly ModelRequest[] {
    return current.calls;
}

/**
 * Registers a tool provider with the running app's copilot registry — the same
 * call `content-server` makes from its own `onModuleInit`.
 *
 * Lives in the harness rather than in a spec because `src/support/**` is the
 * only place exempt from `@nx/enforce-module-boundaries`; specs are not, and a
 * static `@ortha-cms/copilot-server` import in one is a lint error.
 */
export function registerCopilotTools(
    app: INestApplication,
    provider: ToolProvider
): void {
    app.get(ToolRegistry).register(provider);
}

/**
 * The code-defined skills the harness boots with, mirroring what a host
 * declares in `plugins.ts`.
 *
 * Two, and they differ in the one dimension that changes behaviour: `always` is
 * in force whether or not a run asks for it, `manual` only when someone
 * attaches it. A suite that only had one could not tell those apart.
 */
export const testCodeSkills = [
    {
        name: 'house-style',
        title: 'House style',
        description: 'How this deployment writes product copy.',
        mode: 'always' as const,
        instructions: 'ALWAYS-ON-SKILL-BODY: write in sentence case.'
    },
    {
        name: 'seo-checklist',
        title: 'SEO checklist',
        description: 'What to check before publishing.',
        mode: 'manual' as const,
        instructions: 'MANUAL-SKILL-BODY: check the meta description.'
    }
];

/** One run's audit rows — the surface a security review reads. */
export function copilotToolCallRows(app: INestApplication, runId: string) {
    return app.get(ConversationRepository).toolCalls(runId);
}
