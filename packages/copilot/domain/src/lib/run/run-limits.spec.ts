import {
    interruptionNote,
    wasCutShort,
    type RunStopReason
} from './run-limits';

/**
 * Every member of the union, listed by hand.
 *
 * The phrasing table is module-private now (ORT-109), so this is what makes the
 * exhaustiveness check below real: a new stop reason has to be added here or a
 * later assertion notices, which is what `F34` asked for and never had.
 */
const ALL_STOP_REASONS: RunStopReason[] = [
    'end',
    'max-steps',
    'max-tokens',
    'timeout',
    'max-output-tokens',
    'refusal',
    'aborted',
    'error'
];

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
    it('names why the turn stopped, not merely that it did', () => {
        // The ceilings are the engine's; the model cannot infer which one it
        // hit, and "that turn did not finish" alone does not tell it whether
        // resuming is even worth trying.
        expect(interruptionNote('max-steps')).toContain('maximum number of');
        expect(interruptionNote('timeout')).toContain('longer than allowed');
    });

    // ORT-109: this text is written for the **model**, and is deliberately not
    // the user-facing copy. `copilot/admin` renders its own translated strings
    // from the same `RunStopReason`, because a record of finished English
    // sentences cannot enter react-intl — no message id, nothing to translate.
    // So the phrasing table is private, and the two are free to differ.
    it('says something distinct for every reason', () => {
        const notes = ALL_STOP_REASONS.map(interruptionNote);

        expect(new Set(notes).size).toBe(ALL_STOP_REASONS.length);
    });

    it('never renders a reason as undefined', () => {
        // The table is a `Record<RunStopReason, string>`, so a missing member
        // is a type error — but only while the union and the table are edited
        // together. This is what notices if they are not.
        for (const note of ALL_STOP_REASONS.map(interruptionNote)) {
            expect(note).not.toContain('undefined');
        }
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
        for (const reason of ALL_STOP_REASONS) {
            const note = interruptionNote(reason);

            expect(note.startsWith('(')).toBe(true);
            expect(note.endsWith(')')).toBe(true);
            // A note, not a summary: this rides on every replay of an
            // interrupted turn, so its cost has to stay negligible.
            expect(note.length).toBeLessThan(320);
        }
    });
});
