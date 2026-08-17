import {
    DEFAULT_MODEL_CHOICE,
    modelChoiceKey,
    parseModelChoiceKey,
    readStoredModelChoice,
    storedModelChoice
} from './useCopilotModels';

describe('model choice keys', () => {
    it('round-trips a plain choice', () => {
        const choice = { provider: 'claude', model: 'claude-opus-5' };

        expect(parseModelChoiceKey(modelChoiceKey(choice))).toEqual(choice);
    });

    // The case a naive `split(':')` gets wrong: Ollama and friends put a colon
    // in the model id itself, so only the FIRST one separates the two halves.
    it('round-trips a model id containing colons', () => {
        const choice = { provider: 'ollama', model: 'llama3.1:8b-instruct' };

        expect(parseModelChoiceKey(modelChoiceKey(choice))).toEqual(choice);
    });

    it('rejects a key with no separator', () => {
        expect(parseModelChoiceKey('claude')).toBeNull();
    });

    it('rejects a key with an empty half', () => {
        expect(parseModelChoiceKey(':model')).toBeNull();
        expect(parseModelChoiceKey('provider:')).toBeNull();
    });
});

/**
 * The form a **thread** remembers its model in, which has one state more than
 * the picker does: "nobody has picked here" is not the same as "Default", and
 * collapsing the two is what would make reopening a saved conversation silently
 * opt the user out of the host's per-run routing.
 */
describe('the stored model choice', () => {
    it('writes Default as a choice in its own right', () => {
        // Not the absence of one: it means "whatever the resolver picks", which
        // can differ per run — recording today's default provider instead would
        // pin the thread to something the user did not choose.
        expect(storedModelChoice(null)).toBe(DEFAULT_MODEL_CHOICE);
    });

    it('round-trips a concrete backend', () => {
        const choice = { provider: 'anthropic', model: 'claude-opus-5' };

        expect(readStoredModelChoice(storedModelChoice(choice))).toEqual(
            choice
        );
    });

    it('round-trips a model id containing colons', () => {
        const choice = { provider: 'ollama', model: 'llama3.1:8b' };

        expect(readStoredModelChoice(storedModelChoice(choice))).toEqual(
            choice
        );
    });

    it('reads Default back as no choice', () => {
        expect(readStoredModelChoice(DEFAULT_MODEL_CHOICE)).toBeNull();
    });

    it('keeps the sentinel unambiguous — it has no separator', () => {
        // Which is the whole reason one nullable text column can carry three
        // states: any real key contains a colon, and `'default'` cannot.
        expect(DEFAULT_MODEL_CHOICE).not.toContain(':');
        expect(parseModelChoiceKey(DEFAULT_MODEL_CHOICE)).toBeNull();
    });

    it('reads a malformed stored value as no choice rather than half of one', () => {
        // A row written by an older client, or by hand. Falling back to the
        // resolver is the only safe reading; half a choice is not a backend.
        expect(readStoredModelChoice('anthropic')).toBeNull();
        expect(readStoredModelChoice(':claude-opus-5')).toBeNull();
    });
});
