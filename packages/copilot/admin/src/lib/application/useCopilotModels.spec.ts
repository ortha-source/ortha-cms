import { modelChoiceKey, parseModelChoiceKey } from './useCopilotModels';

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
