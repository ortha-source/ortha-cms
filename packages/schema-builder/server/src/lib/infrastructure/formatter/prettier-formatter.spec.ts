import { join } from 'node:path';
import { PrettierFormatter } from './prettier-formatter';

describe('PrettierFormatter', () => {
    // The repository root: its own prettier config (4 spaces, single quotes).
    const root = join(__dirname, '../../../../../../..');

    it("formats with the project's own configuration", async () => {
        const formatted = await new PrettierFormatter(root).format(
            'export const x = {a: "b", c: [1,2]};',
            'apps/server/src/content/collections/x.ts'
        );
        expect(formatted).toBe("export const x = { a: 'b', c: [1, 2] };\n");
    });

    it('breaks a long line the way the check expects', async () => {
        const source = `export const t = collection('t', { fields: { title: field.text({ required: true, maxLength: 200, admin: { label: 'Title' } }) } });`;
        const formatted = await new PrettierFormatter(root).format(
            source,
            'apps/server/src/content/collections/t.ts'
        );
        expect(formatted.split('\n')[1]).toBe('    fields: {');
    });
});
