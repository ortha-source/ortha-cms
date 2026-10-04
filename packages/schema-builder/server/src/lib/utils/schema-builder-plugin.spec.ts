import { SchemaBuilderPlugin } from './schema-builder-plugin';

const base = { enabled: false, production: false, projectRoot: '/srv/app' };

describe('SchemaBuilderPlugin', () => {
    it('is named schema-builder and owns no migrations', () => {
        const plugin = SchemaBuilderPlugin(base);
        expect(plugin.name).toBe('schema-builder');
        expect(plugin.migrations).toBeUndefined();
    });

    it('refuses a relative projectRoot — the working directory is not the app', () => {
        expect(() =>
            SchemaBuilderPlugin({ ...base, projectRoot: 'apps/server' })
        ).toThrow(/projectRoot must be an absolute path/);
    });

    it('refuses a contentDir that leaves the project', () => {
        expect(() =>
            SchemaBuilderPlugin({ ...base, contentDir: '/abs/content' })
        ).toThrow(/contentDir/);
        expect(() =>
            SchemaBuilderPlugin({ ...base, contentDir: '../content' })
        ).toThrow(/contentDir/);
        expect(() =>
            SchemaBuilderPlugin({ ...base, contentDir: 'src/../../x' })
        ).toThrow(/contentDir/);
    });

    it('accepts a contentDir inside it', () => {
        expect(() =>
            SchemaBuilderPlugin({ ...base, contentDir: 'lib/content' })
        ).not.toThrow();
    });
});
