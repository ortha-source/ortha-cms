import { readOutcome } from './read-outcome';

const run = (output: string, timedOut = false) => ({ output, timedOut });

describe('readOutcome', () => {
    it('is generated when a new SQL file appeared, whatever the output says', () => {
        expect(readOutcome(run('anything'), 1)).toBe('generated');
    });

    it('is unchanged when drizzle-kit says there is nothing to migrate', () => {
        expect(
            readOutcome(run('No schema changes, nothing to migrate 😴'), 0)
        ).toBe('unchanged');
    });

    it('is ambiguous when it wanted to ask about a rename — which exits 0 without a TTY', () => {
        expect(
            readOutcome(
                run('Error: Interactive prompts require a TTY terminal'),
                0
            )
        ).toBe('ambiguous');
        expect(
            readOutcome(
                run(
                    'Is legacy column in t table created or renamed from another column?'
                ),
                0
            )
        ).toBe('ambiguous');
    });

    it('is failed for anything else — a zero exit proves nothing', () => {
        expect(
            readOutcome(run('TransformError: Unexpected end of file'), 0)
        ).toBe('failed');
        expect(
            readOutcome(run('No schema changes, nothing to migrate', true), 0)
        ).toBe('failed');
        expect(readOutcome(run(''), 0)).toBe('failed');
    });
});
