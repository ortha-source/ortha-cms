import { PassThrough } from 'node:stream';
import { multiselect, select, type Choice } from './ui';

const ESC = '\u001b';
const ENTER = '\r';
const SPACE = ' ';
const DOWN = `${ESC}[B`;

const MEDIA: Choice[] = [
    { value: 'media-local', label: 'Local filesystem', selected: true },
    { value: 'media-azure', label: 'Azure Blob Storage' },
    { value: 'media-s3', label: 'S3-compatible', disabled: true }
];

const COPILOT: Choice[] = [
    { value: 'copilot-anthropic', label: 'Claude (Anthropic)' },
    { value: 'copilot-openai', label: 'OpenAI-compatible endpoint' }
];

/**
 * A stand-in for a terminal: a stream the test can type into, claiming to be a
 * TTY so the pickers treat it as one.
 */
function fakeStdin(): PassThrough {
    const stream = new PassThrough();
    Object.assign(stream, { isTTY: true, setRawMode: () => stream });
    return stream;
}

describe('the keyboard pickers', () => {
    const realStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
    let stdin: PassThrough;
    let painted: jest.SpyInstance;

    beforeEach(() => {
        stdin = fakeStdin();
        Object.defineProperty(process, 'stdin', {
            value: stdin,
            configurable: true
        });
        painted = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    });

    afterEach(() => {
        if (realStdin) Object.defineProperty(process, 'stdin', realStdin);
        painted.mockRestore();
    });

    /** Types `keys` one keypress at a time, as a terminal delivers them. */
    async function type(...keys: string[]): Promise<void> {
        for (const key of keys) {
            stdin.write(key);
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    describe('select', () => {
        it('answers with the focused row', async () => {
            const answer = select('Where?', MEDIA);
            await type(ENTER);

            await expect(answer).resolves.toBe('media-local');
        });

        it('moves the cursor with the arrow keys', async () => {
            const answer = select('Where?', MEDIA);
            await type(DOWN, ENTER);

            await expect(answer).resolves.toBe('media-azure');
        });

        it('wraps past the unavailable row rather than landing on it', async () => {
            const answer = select('Where?', MEDIA);
            await type(DOWN, DOWN, ENTER);

            await expect(answer).resolves.toBe('media-local');
        });

        it('answers with undefined when escaped', async () => {
            const answer = select('Where?', MEDIA);
            await type(ESC);

            await expect(answer).resolves.toBeUndefined();
        });
    });

    describe('multiselect', () => {
        it('answers with the ticked rows', async () => {
            const answer = multiselect('Which backends?', COPILOT);
            await type(SPACE, DOWN, SPACE, ENTER);

            await expect(answer).resolves.toEqual([
                'copilot-anthropic',
                'copilot-openai'
            ]);
        });

        it('answers with nothing ticked, which is a real answer', async () => {
            const answer = multiselect('Which backends?', COPILOT);
            await type(ENTER);

            await expect(answer).resolves.toEqual([]);
        });
    });

    /**
     * The wizard asks four of these in a row. Reading keys with
     * `for await (const chunk of stdin)` used to destroy stdin as soon as a
     * picker was answered, so the *second* picker rejected with
     * `AbortError: The operation was aborted` the moment it painted — the media
     * question answered, and the copilot question aborting the scaffold before
     * anyone could press a key.
     */
    it('keeps stdin readable for the picker after it', async () => {
        const media = select('Where should uploads be stored?', MEDIA);
        await type(ENTER);
        await expect(media).resolves.toBe('media-local');
        expect(stdin.destroyed).toBe(false);

        const copilot = multiselect('Which model backends?', COPILOT);
        await type(SPACE, ENTER);
        await expect(copilot).resolves.toEqual(['copilot-anthropic']);

        const sso = multiselect('Which identity providers?', COPILOT);
        await type(ENTER);
        await expect(sso).resolves.toEqual([]);

        const protocols = select('Which protocols?', MEDIA);
        await type(ENTER);
        await expect(protocols).resolves.toBe('media-local');
    });
});
