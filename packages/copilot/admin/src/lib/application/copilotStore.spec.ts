import {
    beginRun,
    chatStateOf,
    copilotStoreState,
    dispatchSessions,
    endCopilotSession,
    nextSessionId,
    rememberSkills,
    resetCopilotStore,
    runController,
    seedSkills,
    subscribeToCopilotStore
} from './copilotStore';

/**
 * `endCopilotSession` — what a change of the identity behind the tab does to
 * the chats.
 *
 * The store lives outside React so that nothing unmounting can cancel a run,
 * and that is precisely why signing out cancelled nothing either: the dock
 * held the previous account's chats for whoever signed in next, and a run
 * still streaming kept streaming. The plugin registers this into identity's
 * `SESSION_RESET_SLOT`; these cases pin what it has to do once it is called.
 */
describe('endCopilotSession', () => {
    beforeEach(() => {
        resetCopilotStore();
    });

    /** Opens a chat with a run in flight, the state a sign-out interrupts. */
    function openRunningChat(): { id: string; controller: AbortController } {
        const id = nextSessionId();
        dispatchSessions({ type: 'open', id });
        const controller = new AbortController();
        beginRun(id, controller);
        return { id, controller };
    }

    it('drops every chat and its transcript', () => {
        const first = openRunningChat();
        const second = openRunningChat();
        expect(copilotStoreState().sessions).toHaveLength(2);

        endCopilotSession();

        expect(copilotStoreState().sessions).toEqual([]);
        expect(copilotStoreState().chats).toEqual({});
        expect(chatStateOf(first.id).messages).toEqual([]);
        expect(chatStateOf(second.id).messages).toEqual([]);
    });

    it('aborts every run in flight', () => {
        const first = openRunningChat();
        const second = openRunningChat();

        endCopilotSession();

        // Aborting the fetch is also what stops the run server-side: the
        // server treats a client disconnect as `stopReason: 'aborted'`.
        expect(first.controller.signal.aborted).toBe(true);
        expect(second.controller.signal.aborted).toBe(true);
        expect(runController(first.id)).toBeNull();
        expect(runController(second.id)).toBeNull();
    });

    it('tells the mounted views, and keeps listening afterwards', () => {
        openRunningChat();
        const listener = jest.fn();
        subscribeToCopilotStore(listener);

        endCopilotSession();
        expect(listener).toHaveBeenCalledTimes(1);

        // Still subscribed: the dock is mounted when a sign-out lands, and the
        // next account's first chat has to reach it too.
        dispatchSessions({ type: 'open', id: nextSessionId() });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('forgets the staged skills it would seed into the next chat', () => {
        rememberSkills(['house-style']);

        endCopilotSession();

        expect(seedSkills()).toEqual([]);
    });

    it('never reuses an id a cancelled run might still write to', () => {
        const { id } = openRunningChat();

        endCopilotSession();

        expect(nextSessionId()).not.toBe(id);
    });

    it('is a no-op the second time', () => {
        openRunningChat();
        const listener = jest.fn();
        subscribeToCopilotStore(listener);

        endCopilotSession();
        const after = copilotStoreState();
        endCopilotSession();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(copilotStoreState()).toBe(after);
    });
});
