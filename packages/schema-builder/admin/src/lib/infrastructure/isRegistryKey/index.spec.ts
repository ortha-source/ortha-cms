import { isRegistryKey } from './index';

describe('isRegistryKey', () => {
    it.each([
        [['content-schema', 'article']],
        [['workspace-content-access', 'ws1', 'content-schema-list']],
        [['content-filter-fields', 'ws1', 'article']],
        [['content-types']]
    ])('marks %j as built from the registry', (key) => {
        expect(isRegistryKey(key)).toBe(true);
    });

    it.each([
        [['content-entries', 'article']],
        [['webhooks', 'list']],
        [['schema-builder', 'document']]
    ])('leaves %j alone', (key) => {
        expect(isRegistryKey(key)).toBe(false);
    });
});
