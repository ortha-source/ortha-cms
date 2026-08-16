import { NoModelsConfiguredError } from '../errors/no-models-configured.error';
import { UnknownModelError } from '../errors/unknown-model.error';
import { resolveModel } from './resolve-model';

const AVAILABLE = ['claude-opus-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];

describe('resolveModel', () => {
    it('returns the model the request named', () => {
        expect(resolveModel('claude-haiku-4-5', AVAILABLE)).toBe(
            'claude-haiku-4-5'
        );
    });

    // Declaration order is the contract `ModelProvider.models()` states, so a
    // provider can change its default by reordering rather than by code.
    it('defaults to the first declared model', () => {
        expect(resolveModel(undefined, AVAILABLE)).toBe('claude-opus-5');
    });

    // Falling back would answer on a different model than the caller asked
    // for, and bill it silently.
    it('throws rather than falling back to the default', () => {
        expect(() => resolveModel('gpt-9', AVAILABLE)).toThrow(
            UnknownModelError
        );
    });

    it('names the requested model and what is available', () => {
        expect(() => resolveModel('gpt-9', AVAILABLE)).toThrow(
            /"gpt-9".*claude-opus-5/s
        );
    });

    // An empty string is not "unspecified": the caller sent something, and it
    // is not on offer. The controller only forwards `model` when truthy, so
    // this is the second of two layers rather than a live path.
    it('treats an empty model id as unknown, not as absent', () => {
        expect(() => resolveModel('', AVAILABLE)).toThrow(UnknownModelError);
    });

    // The SSE controller classifies what it catches to decide whether a
    // failure is an operator misconfiguration or a fault, and a bare `Error`
    // is indistinguishable from a crash.
    it('throws a typed error when the provider declares no models', () => {
        expect(() => resolveModel(undefined, [])).toThrow(
            NoModelsConfiguredError
        );
        expect(() => resolveModel('anything', [])).toThrow(
            NoModelsConfiguredError
        );
    });

    it('does not confuse the two failures', () => {
        expect(() => resolveModel(undefined, [])).not.toThrow(
            UnknownModelError
        );
    });
});
