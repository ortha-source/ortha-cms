import {
    isProduction,
    NODE_ENVS,
    readList,
    readNodeEnv,
    readOptionalPositiveInt,
    readPositiveInt,
    readTrustProxy,
    requireEnv
} from './env';

/**
 * The environment readers.
 *
 * Worth pinning because the failure mode of every one of these is **silence**.
 * `Number(process.env[x]) || default` accepted a negative and swallowed a
 * zero; `NODE_ENV !== 'production'` reads a misspelling as "not production".
 * Neither is visible from outside the process until a session expires on
 * arrival or a cookie ships without `Secure`, so each reader's refusal is the
 * behaviour under test, not an edge case around it.
 */
describe('environment readers', () => {
    const saved = { ...process.env };

    afterEach(() => {
        process.env = { ...saved };
    });

    /** Sets (or, for `undefined`, clears) one variable for the next read. */
    function set(name: string, value: string | undefined): void {
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }

    describe('requireEnv', () => {
        it('returns the trimmed value', () => {
            set('ORTHA_TEST_URL', '  postgres://x  ');
            expect(requireEnv('ORTHA_TEST_URL')).toBe('postgres://x');
        });

        it('names the variable when it is missing', () => {
            set('ORTHA_TEST_URL', undefined);
            expect(() => requireEnv('ORTHA_TEST_URL')).toThrow(
                /ORTHA_TEST_URL/
            );
        });

        it('treats an empty value as missing, not as a valid setting', () => {
            // Left to pass through, an empty DATABASE_URL reaches pg as "use
            // the libpq defaults" and fails several seconds later with a
            // message naming SASL rather than the variable.
            set('ORTHA_TEST_URL', '   ');
            expect(() => requireEnv('ORTHA_TEST_URL')).toThrow(
                /ORTHA_TEST_URL/
            );
        });

        it('carries a caller-supplied hint into the message', () => {
            set('ORTHA_TEST_URL', undefined);
            expect(() => requireEnv('ORTHA_TEST_URL', 'Copy `.env.example`.')) //
                .toThrow(/Copy `\.env\.example`\./);
        });
    });

    describe('readPositiveInt', () => {
        it('falls back when unset or empty', () => {
            set('ORTHA_TEST_N', undefined);
            expect(readPositiveInt('ORTHA_TEST_N', 7)).toBe(7);
            // Empty is not an error: `.env.example` ships keys with no value
            // and a fresh clone has to boot from it unchanged.
            set('ORTHA_TEST_N', '');
            expect(readPositiveInt('ORTHA_TEST_N', 7)).toBe(7);
        });

        it('reads a plain decimal integer', () => {
            set('ORTHA_TEST_N', '42');
            expect(readPositiveInt('ORTHA_TEST_N', 7)).toBe(42);
        });

        it('rejects zero rather than substituting the default', () => {
            // `0` is falsy, so `Number(x) || default` read "block every login"
            // as "allow ten a minute".
            set('ORTHA_TEST_N', '0');
            expect(() => readPositiveInt('ORTHA_TEST_N', 7)).toThrow(
                /positive whole number/
            );
        });

        it('rejects a negative rather than accepting it', () => {
            // A negative is truthy, so it went through: a negative session TTL
            // issues every session already expired — login answers 201 and the
            // very next request 401.
            set('ORTHA_TEST_N', '-1');
            expect(() => readPositiveInt('ORTHA_TEST_N', 7)).toThrow(
                /positive whole number/
            );
        });

        it('rejects exponent and hex notation, which `Number` would take', () => {
            for (const raw of ['1e9', '0x20', 'Infinity', '3.5']) {
                set('ORTHA_TEST_N', raw);
                expect(() => readPositiveInt('ORTHA_TEST_N', 7)).toThrow(
                    /positive whole number/
                );
            }
        });
    });

    describe('readOptionalPositiveInt', () => {
        it('is undefined when unset, so a plugin default survives a spread', () => {
            set('ORTHA_TEST_N', undefined);
            expect(readOptionalPositiveInt('ORTHA_TEST_N')).toBeUndefined();
        });

        it('applies the same refusals as the defaulted form', () => {
            set('ORTHA_TEST_N', '0');
            expect(() => readOptionalPositiveInt('ORTHA_TEST_N')).toThrow(
                /positive whole number/
            );
        });
    });

    describe('readList', () => {
        it('splits, trims and drops blanks', () => {
            set('ORTHA_TEST_LIST', ' a , b ,, c ');
            expect(readList('ORTHA_TEST_LIST', 'z')).toEqual(['a', 'b', 'c']);
        });

        it('uses the fallback only when the variable is absent', () => {
            set('ORTHA_TEST_LIST', undefined);
            expect(readList('ORTHA_TEST_LIST', 'z')).toEqual(['z']);
        });

        it('reads an explicitly empty value as an empty list', () => {
            // "Allow no origins" is a setting somebody means; falling back to
            // the default there would quietly re-admit the dev origin.
            set('ORTHA_TEST_LIST', '');
            expect(readList('ORTHA_TEST_LIST', 'z')).toEqual([]);
        });
    });

    describe('readTrustProxy', () => {
        it('is undefined when unset, leaving forwarded headers ignored', () => {
            set('TRUST_PROXY', undefined);
            expect(readTrustProxy()).toBeUndefined();
        });

        it('prefers a hop count — the form a client cannot forge past', () => {
            set('TRUST_PROXY', '1');
            expect(readTrustProxy()).toBe(1);
            set('TRUST_PROXY', '0');
            expect(readTrustProxy()).toBe(0);
        });

        it('reads the two booleans', () => {
            set('TRUST_PROXY', 'true');
            expect(readTrustProxy()).toBe(true);
            set('TRUST_PROXY', 'false');
            expect(readTrustProxy()).toBe(false);
        });

        it('passes anything else through as a subnet or preset', () => {
            set('TRUST_PROXY', 'loopback');
            expect(readTrustProxy()).toBe('loopback');
            set('TRUST_PROXY', '10.0.0.0/8');
            expect(readTrustProxy()).toBe('10.0.0.0/8');
        });
    });

    describe('readNodeEnv', () => {
        it('is undefined when unset — the ordinary local state', () => {
            set('NODE_ENV', undefined);
            expect(readNodeEnv()).toBeUndefined();
            expect(isProduction()).toBe(false);
        });

        it('reads each recognised mode', () => {
            for (const mode of NODE_ENVS) {
                set('NODE_ENV', mode);
                expect(readNodeEnv()).toBe(mode);
            }
        });

        it('refuses a misspelling instead of reading it as "not production"', () => {
            // `produciton` served /reference/json to an unauthenticated caller
            // and dropped `Secure` from the session cookie, exactly as if
            // nothing had been set (ORT-137).
            set('NODE_ENV', 'produciton');
            expect(() => readNodeEnv()).toThrow(/produciton/);
            expect(() => isProduction()).toThrow(/produciton/);
        });

        it('is true only for production', () => {
            set('NODE_ENV', 'production');
            expect(isProduction()).toBe(true);
            set('NODE_ENV', 'development');
            expect(isProduction()).toBe(false);
        });
    });
});
