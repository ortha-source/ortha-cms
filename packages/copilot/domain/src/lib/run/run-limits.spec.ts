import {
    RUN_STOP_EXPLANATIONS,
    interruptionNote,
    wasCutShort,
    type RunStopReason
} from './run-limits';

describe('wasCutShort', () => {
    // The whole point of the note: these are the engine's ceilings, which the
    // model never sees and cannot infer from its own output.
    it.each<RunStopReason>([
        'max-steps',
        'max-tokens',
        'timeout',
        'max-output-tokens',
        'aborted',
        'error'
    ])('treats %s as a turn that was cut off', (reason) => {
        expect(wasCutShort(reason)).toBe(true);
    });

    it('leaves a turn that simply finished alone', () => {
        expect(wasCutShort('end')).toBe(false);
    });

    // Deliberate, not an oversight. A note inviting the model to "resume from
    // where it stopped" is exactly the nudge a refusal must not get.
    it('leaves a refusal alone', () => {
        expect(wasCutShort('refusal')).toBe(false);
    });

    it('treats an unset stop reason as not cut off', () => {
        // Older rows, and every user turn, carry no stop reason at all.
        expect(wasCutShort(null)).toBe(false);
    });

    it('ignores a stop reason it does not recognise', () => {
        expect(wasCutShort('something-else')).toBe(false);
    });
});

describe('interruptionNote', () => {
    it('names the reason using the same words the UI shows', () => {
        // One vocabulary, so what a user is told and what the model is told
        // cannot drift apart.
        expect(interruptionNote('max-steps')).toContain(
            RUN_STOP_EXPLANATIONS['max-steps']
        );
    });

    it('says the interrupted work is missing, and to resume rather than restart', () => {
        const note = interruptionNote('timeout');

        // `normalizeTranscript` drops the `tool_use` blocks a cut-off run never
        // got results for, so the model has to be told that what it can see
        // itself starting is genuinely absent.
        expect(note).toContain('absent from this transcript');
        expect(note).toContain('resume from where it');
        expect(note).toContain('rather than starting the task again');
    });

    it('stays one short parenthetical for every reason', () => {
        for (const reason of Object.keys(
            RUN_STOP_EXPLANATIONS
        ) as RunStopReason[]) {
            const note = interruptionNote(reason);

            expect(note.startsWith('(')).toBe(true);
            expect(note.endsWith(')')).toBe(true);
            // A note, not a summary: this rides on every replay of an
            // interrupted turn, so its cost has to stay negligible.
            expect(note.length).toBeLessThan(320);
        }
    });
});
