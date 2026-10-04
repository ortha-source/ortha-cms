import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePackageBin } from './resolve-package-bin';

describe('resolvePackageBin', () => {
    const root = join(__dirname, '../../../../../../..');

    it("finds a CLI through the manifest's bin field — drizzle-kit, which exports no package.json", () => {
        const bin = resolvePackageBin(root, 'drizzle-kit', 'drizzle-kit');
        expect(bin.endsWith(join('drizzle-kit', 'bin.cjs'))).toBe(true);
        expect(existsSync(bin)).toBe(true);
    });

    it('finds prettier the same way', () => {
        expect(
            existsSync(resolvePackageBin(root, 'prettier', 'prettier'))
        ).toBe(true);
    });

    it('says what is missing', () => {
        expect(() =>
            resolvePackageBin('/nowhere', 'not-a-real-package-xyz', 'x')
        ).toThrow(/not installed/);
    });
});
