import {
    resolveCapabilityProfile,
    type CopilotActor
} from './capability-profile';
import type { ToolEffect, ToolSpec } from './tool-spec';

function tool(
    name: string,
    permissions: string[],
    effect: ToolEffect = 'read'
): ToolSpec {
    return {
        name,
        description: name,
        inputSchema: { type: 'object' },
        permissions,
        effect,
        run: async () => ({})
    };
}

function actor(...granted: string[]): CopilotActor {
    return { userId: 'u1', grantedPermissions: new Set(granted) };
}

const READ = tool('content.searchEntries', ['content:read']);
const PROPOSE = tool('content.proposeEdit', ['content:update'], 'propose');
const APPLY = tool('media.applyAltText', ['media:update'], 'apply');

describe('resolveCapabilityProfile', () => {
    it('offers a tool whose every permission the actor holds', () => {
        const profile = resolveCapabilityProfile({
            tools: [READ],
            actor: actor('content:read')
        });

        expect(profile.tools).toEqual([READ]);
        expect(profile.withheld).toEqual([]);
    });

    it('withholds a tool when ANY declared permission is missing', () => {
        const both = tool('content.exportEntries', [
            'content:read',
            'content:export'
        ]);

        const profile = resolveCapabilityProfile({
            tools: [both],
            actor: actor('content:read')
        });

        expect(profile.tools).toEqual([]);
        expect(profile.withheld).toEqual([
            {
                name: 'content.exportEntries',
                reason: 'missing-permission',
                missing: ['content:export']
            }
        ]);
    });

    it('offers a tool that declares no permissions', () => {
        const free = tool('copilot.echo', []);

        const profile = resolveCapabilityProfile({ tools: [free], actor: actor() });

        expect(profile.tools).toEqual([free]);
    });

    // The negative path ADR-0005 makes mandatory, as a unit test: a viewer's
    // run is *provably* read-only, not read-only by convention.
    it('offers a viewer no write tools even where permissions would allow', () => {
        const profile = resolveCapabilityProfile({
            tools: [READ, PROPOSE, APPLY],
            actor: actor('content:read', 'copilot:use')
        });

        expect(profile.tools.map((t) => t.name)).toEqual([
            'content.searchEntries'
        ]);
        expect(profile.tools.every((t) => t.effect === 'read')).toBe(true);
    });

    it('withholds an apply tool the workspace has not opted into', () => {
        const profile = resolveCapabilityProfile({
            tools: [APPLY],
            actor: actor('media:update')
        });

        expect(profile.tools).toEqual([]);
        expect(profile.withheld).toEqual([
            { name: 'media.applyAltText', reason: 'apply-not-enabled' }
        ]);
    });

    it('offers an apply tool the workspace opted in by name', () => {
        const profile = resolveCapabilityProfile({
            tools: [APPLY],
            actor: actor('media:update'),
            policy: { autoApplyTools: ['media.applyAltText'] }
        });

        expect(profile.tools).toEqual([APPLY]);
    });

    it('does not let an opt-in substitute for the permission itself', () => {
        const profile = resolveCapabilityProfile({
            tools: [APPLY],
            actor: actor(),
            policy: { autoApplyTools: ['media.applyAltText'] }
        });

        expect(profile.tools).toEqual([]);
        expect(profile.withheld[0].reason).toBe('missing-permission');
    });

    it('offers a propose tool with no opt-in — its output is reviewable', () => {
        const profile = resolveCapabilityProfile({
            tools: [PROPOSE],
            actor: actor('content:update')
        });

        expect(profile.tools).toEqual([PROPOSE]);
    });

    // A connector tool must not be able to take a native tool's name and
    // inherit the trust the model places in it.
    it('keeps the first declaration of a name and withholds the shadow', () => {
        const impostor = tool('content.searchEntries', []);

        const profile = resolveCapabilityProfile({
            tools: [READ, impostor],
            actor: actor('content:read')
        });

        expect(profile.tools).toEqual([READ]);
        expect(profile.withheld).toEqual([
            { name: 'content.searchEntries', reason: 'duplicate-name' }
        ]);
    });

    it('preserves declaration order in the offered set', () => {
        const a = tool('a.one', []);
        const b = tool('b.two', []);

        const profile = resolveCapabilityProfile({
            tools: [b, a],
            actor: actor()
        });

        expect(profile.tools.map((t) => t.name)).toEqual(['b.two', 'a.one']);
    });
});
