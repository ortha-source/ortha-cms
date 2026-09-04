import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { SseStream } from './sse-stream';

/**
 * The stream's one **safety-critical** wiring decision: cancellation hangs off
 * the *response*, never off the request.
 *
 * Express has already consumed the request body by the time a handler runs, and
 * a fully-consumed `IncomingMessage` emits `'close'` immediately — while the
 * client is still connected and waiting. An abort wired to `req.on('close')`
 * therefore cancels every run the instant it starts, and because `writeHead`
 * has not flushed yet it presents as a request that *hangs with no response*
 * rather than as an error. `packages/copilot/server/AGENTS.md` has said this is
 * "covered by a test" since the phase-1 spike; it was not, until this file.
 *
 * So the fixture models both objects: `res` is the socket-backed emitter, and
 * `res.req` is the fully-consumed request Express hands the handler — the very
 * emitter the broken implementation would reach for, and reachable from inside
 * `SseStream` as `this.res.req`.
 */
describe('SseStream', () => {
    /** A response stub that records what was written and can be closed. */
    function fakeResponse() {
        const res = new EventEmitter() as EventEmitter & {
            req: EventEmitter;
            writeHead: jest.Mock;
            write: jest.Mock;
            end: jest.Mock;
            flushHeaders: jest.Mock;
        };
        // Express exposes the request on the response, so a broken
        // implementation does not need a second constructor argument to get
        // this wrong — `this.res.req.on('close', …)` is one keystroke away.
        res.req = new EventEmitter();
        res.writeHead = jest.fn();
        res.write = jest.fn();
        res.end = jest.fn();
        res.flushHeaders = jest.fn();
        return res;
    }

    let res: ReturnType<typeof fakeResponse>;
    let stream: SseStream;
    let controller: AbortController;

    beforeEach(() => {
        jest.useFakeTimers();
        res = fakeResponse();
        stream = new SseStream(res as unknown as Response);
        controller = new AbortController();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('leaves the run alone when the consumed request emits close [copilot:I-39]', () => {
        stream.onClientDisconnect(controller);
        stream.open();

        // What Express does on every POST, before the model has said a word.
        res.req.emit('close');

        expect(controller.signal.aborted).toBe(false);

        // And the stream is still live: frames written after the request's own
        // close still reach the client, which is the half that turns a
        // cancelled run into a request that hangs with nothing in it.
        res.write.mockClear();
        stream.send({ type: 'text-delta', text: 'still here' });
        expect(res.write).toHaveBeenCalledWith(
            'event: text-delta\ndata: {"type":"text-delta","text":"still here"}\n\n'
        );
    });

    it('cancels the run when the response closes [copilot:I-39]', () => {
        stream.onClientDisconnect(controller);
        stream.open();

        expect(controller.signal.aborted).toBe(false);

        res.emit('close');

        expect(controller.signal.aborted).toBe(true);
    });

    it('stops writing once the client is gone', () => {
        stream.onClientDisconnect(controller);
        stream.open();
        res.emit('close');
        res.write.mockClear();

        // Neither an event the engine had already produced…
        stream.send({ type: 'text-delta', text: 'too late' });
        // …nor the heartbeat, which would otherwise keep firing on a dead
        // socket for as long as the interval lives.
        jest.advanceTimersByTime(60_000);

        expect(res.write).not.toHaveBeenCalled();
    });

    it('pings an idle connection rather than letting an intermediary reap it', () => {
        stream.open();
        res.write.mockClear();

        jest.advanceTimersByTime(15_000);

        expect(res.write).toHaveBeenCalledWith(': ping\n\n');
    });
});
