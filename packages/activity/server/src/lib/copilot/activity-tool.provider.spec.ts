import { PERMISSIONS } from '@orthacms/identity-server';
import type { ActivityService } from '../activity/services/activity.service';
import { ActivityCopilotToolProvider } from './activity-tool.provider';

/**
 * The markings on `activity_recent`.
 *
 * Three of the four are already pinned end to end — `surfaces: ['copilot']` by
 * the MCP catalogue spec, `requires` by a contributor's call being refused, and
 * the optional registry by a host booting without the copilot. `readOnly` and
 * `effect: 'read'` are pinned nowhere, and they are the two a running system
 * never contradicts out loud: they are read by the run engine to decide whether
 * a call needs the caller's confirmation, so getting them wrong makes the audit
 * log *quieter* to use, not louder. A tool marked writing would start prompting;
 * a writing tool marked read-only would stop.
 *
 * Pure data — the definition is built by a method, not by DI — so this needs no
 * module, no registry and no database.
 */

/** The provider with nothing behind it: `tools()` never calls the service. */
function provider() {
    return new ActivityCopilotToolProvider(
        {} as unknown as ActivityService,
        undefined
    );
}

describe('activity_recent', () => {
    it('is the plugin’s only tool [activity:I-21]', () => {
        expect(
            provider()
                .tools()
                .map((tool) => tool.name)
        ).toEqual(['activity_recent']);
    });

    it('is declared read-only, read-effect, copilot-only, activity:read [activity:I-21]', () => {
        const [tool] = provider().tools();

        expect(tool).toMatchObject({
            readOnly: true,
            effect: 'read',
            surfaces: ['copilot'],
            requires: [PERMISSIONS.ACTIVITY_READ]
        });
    });

    it('registers nothing when no registry is bound [activity:I-22]', () => {
        // The `@Optional()` half, from this side of the seam: a deployment with
        // neither the copilot nor MCP has no `ToolRegistry` to inject, and
        // `onModuleInit` has to be a no-op rather than a start-up failure.
        expect(() => provider().onModuleInit()).not.toThrow();
    });
});

describe('activity_recent with an unparseable date', () => {
    /**
     * The route refuses one with `@IsISO8601`; the tool had no DTO, so the
     * string reached the query as `new Date('last tuesday')` and failed in the
     * driver — a message the model cannot act on. It is now the argument
     * error the route would give, and the query never runs.
     */
    it.each([
        ['from', 'last tuesday'],
        ['to', '2026-13-01']
    ])('refuses %s=%s before querying', async (name, value) => {
        const list = jest.fn();
        const [tool] = new ActivityCopilotToolProvider(
            { list } as unknown as ActivityService,
            undefined
        ).tools();

        await expect(
            tool.handler({ [name]: value }, {} as never)
        ).rejects.toThrow(`\`${name}\` must be an ISO 8601 date`);
        expect(list).not.toHaveBeenCalled();
    });

    it('still accepts a date the route accepts', async () => {
        const list = jest.fn(async () => ({
            items: [],
            total: 0,
            page: 1,
            pageSize: 10
        }));
        const [tool] = new ActivityCopilotToolProvider(
            { list } as unknown as ActivityService,
            undefined
        ).tools();

        await tool.handler({ from: '2026-01-31' }, {} as never);
        expect(list).toHaveBeenCalledWith(
            expect.objectContaining({ from: '2026-01-31' })
        );
    });
});
