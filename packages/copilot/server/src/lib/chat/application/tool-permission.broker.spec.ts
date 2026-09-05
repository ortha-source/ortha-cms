import { ToolPermissionBroker, type RunOwner } from './tool-permission.broker';

/**
 * The broker is the one place that decides **who** may end a parked run, and
 * **how long** a run may sit parked in total. Both were reachable only through
 * a live SSE stream before, which is why neither had a test and both were
 * wrong: a `runId` is handed to the client in `run-started`, so it identifies a
 * run without authorising anyone; and five fresh minutes per call meant a turn
 * asking for thirty writes could hold a connection for two and a half hours.
 */
describe('ToolPermissionBroker', () => {
    const owner: RunOwner = { userId: 'user-1', workspaceId: 'ws-1' };

    let broker: ToolPermissionBroker;
    let controller: AbortController;

    beforeEach(() => {
        jest.useFakeTimers();
        broker = new ToolPermissionBroker();
        controller = new AbortController();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    /**
     * Parks a call and hands back the promise the run is awaiting.
     *
     * Deliberately **not** `async`: an async wrapper would await the promise it
     * is returning, and the test would hang on the very thing it is about to
     * answer. `ask` registers its waiter synchronously (the `new Promise`
     * executor runs before the first suspension), so there is nothing to wait
     * for here.
     */
    function park(runId = 'run-1', callId = 'call-1') {
        return broker.ask(runId, callId, owner, controller.signal);
    }

    it('delivers a decision to the run’s owner', async () => {
        const pending = park();

        expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(true);

        await expect(pending).resolves.toEqual({
            decision: 'once',
            timedOut: false
        });
    });

    it.each([
        [
            'another user in the same workspace',
            { userId: 'user-2', workspaceId: 'ws-1' }
        ],
        [
            'the same user naming another workspace',
            { userId: 'user-1', workspaceId: 'ws-2' }
        ],
        ['a stranger entirely', { userId: 'user-2', workspaceId: 'ws-2' }]
    ])('refuses %s', async (_label, by: RunOwner) => {
        const pending = park();

        // Same `false` as "nothing is waiting", so the route answers 404 either
        // way: whether someone else's run exists is not information to hand out.
        expect(broker.decide('run-1', 'call-1', 'once', by)).toBe(false);

        // …and the run is still parked, waiting for the person it belongs to.
        expect(broker.decide('run-1', 'call-1', 'deny', owner)).toBe(true);
        await expect(pending).resolves.toEqual({
            decision: 'deny',
            timedOut: false
        });
    });

    it('answers false when nothing is waiting', () => {
        expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(false);
    });

    it('refuses a second answer to a settled call [copilot:I-11]', async () => {
        const pending = park();
        expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(true);
        await pending;

        expect(broker.decide('run-1', 'call-1', 'deny', owner)).toBe(false);
    });

    it('times out as a refusal rather than a rejection', async () => {
        const pending = park();

        jest.advanceTimersByTime(5 * 60_000);

        await expect(pending).resolves.toEqual({
            decision: 'deny',
            timedOut: true
        });
    });

    /**
     * The **timeout** exit of the three, and the one that had been reachable
     * only sideways — through the shared budget, which says how much time was
     * spent but nothing about whether the entry survived it.
     *
     * A timer that resolved the promise without running `cleanup` leaves a
     * settled waiter in the map, and every test above still passes: the run
     * already gave up and reported the refusal to the model, so nothing it does
     * is observable *from the run*. It is observable from here — the late
     * answer finds a waiter, `decide` reports success, and `settle` resolves an
     * already-resolved promise, which is a silent no-op. The user is told their
     * "allow" landed, and the tool never runs.
     */
    it('clears the entry when the deadline passes, so a late answer finds nothing [copilot:I-11]', async () => {
        const pending = park();

        jest.advanceTimersByTime(5 * 60_000);
        await expect(pending).resolves.toEqual({
            decision: 'deny',
            timedOut: true
        });

        // Answered by the rightful owner, with a valid decision — the only
        // thing wrong with it is that it is late.
        expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(false);
        // And there is nothing left to give more time to either.
        expect(broker.extend('run-1', 'call-1', owner)).toBeNull();
    });

    it('spends one waiting budget across a run’s calls, not one per call [copilot:I-10]', async () => {
        // Four minutes on the first call…
        const first = park('run-1', 'call-1');
        jest.advanceTimersByTime(4 * 60_000);
        expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(true);
        await expect(first).resolves.toEqual({
            decision: 'once',
            timedOut: false
        });

        // …leaves one minute for the second, not five. Without the run-level
        // budget a turn requesting thirty writes could park for thirty times
        // the limit — the wall clock cannot reach inside a step to stop it.
        const second = park('run-1', 'call-2');
        jest.advanceTimersByTime(60_000);
        await expect(second).resolves.toEqual({
            decision: 'deny',
            timedOut: true
        });
    });

    it('refuses without asking once the budget is gone [copilot:I-10]', async () => {
        const first = park('run-1', 'call-1');
        jest.advanceTimersByTime(5 * 60_000);
        await first;

        // No timer, no wait: the answer is immediate.
        await expect(
            broker.ask('run-1', 'call-2', owner, controller.signal)
        ).resolves.toEqual({ decision: 'deny', timedOut: true });
    });

    it('gives a different run its own budget', async () => {
        const first = park('run-1', 'call-1');
        jest.advanceTimersByTime(5 * 60_000);
        await first;

        const other = park('run-2', 'call-1');
        expect(broker.decide('run-2', 'call-1', 'chat', owner)).toBe(true);
        await expect(other).resolves.toEqual({
            decision: 'chat',
            timedOut: false
        });
    });

    it('rejects on abort, so the generator unwinds instead of leaking [copilot:I-11]', async () => {
        const pending = park();
        controller.abort(new Error('client went away'));

        await expect(pending).rejects.toThrow('client went away');
        // The waiter is gone, so a late answer finds nothing.
        expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(false);
    });

    it('rejects immediately when the signal is already aborted', async () => {
        controller.abort(new Error('already gone'));

        await expect(
            broker.ask('run-1', 'call-1', owner, controller.signal)
        ).rejects.toThrow('already gone');
    });

    /**
     * The **other** thing a `runId` would otherwise let a stranger do.
     *
     * Answering someone else's parked run is refused above; extending it is the
     * same authority wearing a different verb, and the reason it needs saying
     * separately is that `extend` is a second, later-added entry point into the
     * same map — it re-implements the ownership comparison rather than sharing
     * one, so deleting either check leaves the other's tests green.
     *
     * A colleague in the same workspace is the case that matters: `copilot:use`
     * is held by every role and `WorkspaceGuard` passes for them, so the broker
     * is the only thing standing between them and a run that is not theirs.
     */
    describe('extending a parked call', () => {
        it.each([
            [
                'another user in the same workspace',
                { userId: 'user-2', workspaceId: 'ws-1' }
            ],
            [
                'the same user naming another workspace',
                { userId: 'user-1', workspaceId: 'ws-2' }
            ],
            ['a stranger entirely', { userId: 'user-2', workspaceId: 'ws-2' }]
        ])(
            'refuses %s the same way it refuses nothing-is-waiting [copilot:I-09]',
            async (_label, by: RunOwner) => {
                const pending = park();

                // `null`, which the route turns into the same 404 as a run that
                // is not parked at all — the pair below is what makes the two
                // indistinguishable from outside.
                expect(broker.extend('run-1', 'call-1', by)).toBeNull();
                expect(broker.extend('run-9', 'call-9', owner)).toBeNull();

                // The run is untouched: still parked, still the owner's to end.
                expect(broker.decide('run-1', 'call-1', 'deny', owner)).toBe(
                    true
                );
                await expect(pending).resolves.toEqual({
                    decision: 'deny',
                    timedOut: false
                });
            }
        );

        /**
         * The contrast, without which the refusals above hold for the trivial
         * reason that `extend` never grants anything: the owner gets a fresh
         * allowance, and it really is armed — four of the five minutes pass
         * with the call still parked, where an unextended one would have expired
         * at the fifth.
         */
        it('grants the owner a fresh allowance [copilot:I-09]', async () => {
            const pending = park();

            jest.advanceTimersByTime(4 * 60_000);
            expect(broker.extend('run-1', 'call-1', owner)).toBe(5 * 60_000);

            // Past the original deadline, and still waiting.
            jest.advanceTimersByTime(4 * 60_000);
            expect(broker.decide('run-1', 'call-1', 'once', owner)).toBe(true);
            await expect(pending).resolves.toEqual({
                decision: 'once',
                timedOut: false
            });
        });
    });
});
