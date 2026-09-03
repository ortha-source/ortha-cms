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
});
