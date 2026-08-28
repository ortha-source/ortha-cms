import { flag, option, wantsHelp } from './args';

describe('wantsHelp', () => {
    // The regression: `--help` lands in the command position, so a check that
    // only read the arguments after it answered with `Unknown command`.
    it.each([['--help'], ['-h'], ['help']])(
        'treats a bare %s as a request for the usage text',
        (arg) => {
            expect(wantsHelp([arg])).toBe(true);
        }
    );

    it('shows the usage text when nothing at all was typed', () => {
        expect(wantsHelp([])).toBe(true);
    });

    it('answers a help flag asked after a command', () => {
        expect(wantsHelp(['migrate', '--help'])).toBe(true);
        expect(wantsHelp(['build', '-h'])).toBe(true);
    });

    it('leaves real commands to run', () => {
        expect(wantsHelp(['migrate'])).toBe(false);
        expect(wantsHelp(['build', '--server'])).toBe(false);
        expect(wantsHelp(['generate', '--name=add_posts'])).toBe(false);
    });

    it('does not mistake a value that merely says help for the flag', () => {
        expect(wantsHelp(['generate', '--name=help'])).toBe(false);
    });
});

describe('option', () => {
    it('reads both --flag=value and --flag value', () => {
        expect(option(['--name=add_posts'], 'name')).toBe('add_posts');
        expect(option(['--name', 'add_posts'], 'name')).toBe('add_posts');
    });

    it('is undefined when absent, or when the next token is another flag', () => {
        expect(option(['--server'], 'name')).toBeUndefined();
        expect(option(['--name', '--server'], 'name')).toBeUndefined();
    });
});

describe('flag', () => {
    it('is true only for the bare flag', () => {
        expect(flag(['--server'], 'server')).toBe(true);
        expect(flag(['--admin'], 'server')).toBe(false);
    });
});
