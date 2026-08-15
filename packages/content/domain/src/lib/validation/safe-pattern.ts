/**
 * Compilation and a **complexity bound** for author-supplied `pattern` rules.
 *
 * A field's `validation.pattern` is a regex *source string* written by whoever
 * models the content type. It is then compiled and run against author-supplied
 * values, so it is untrusted input twice over:
 *
 * - an **uncompilable** source (`'('`) throws a `SyntaxError` out of the
 *   validator, which is a 500 on the server rather than a validation issue; and
 * - an **ambiguous** source (`'^(a+)+$'`) backtracks exponentially — 30 `a`s
 *   followed by one non-matching character pins a core for minutes. There is no
 *   way to interrupt a synchronous `RegExp.test` in JavaScript, so the only
 *   defence is to refuse to run the pattern at all.
 *
 * Both are therefore resolved **before** matching, and both fail closed: an
 * unusable pattern rule fails its field instead of being silently skipped.
 *
 * The safety check is the classic *star-height* heuristic, narrowed to cut
 * false positives. A group quantified with an unbounded quantifier (`*`, `+`,
 * `{n,}`) is flagged only when one of its alternatives is **entirely** made of
 * quantified atoms and at least one of those is itself unbounded — the shape
 * that lets the engine split the same input across iterations in exponentially
 * many ways:
 *
 * | Pattern            | Verdict | Why |
 * | --                 | --      | -- |
 * | `(a+)+`            | unsafe  | body is one unbounded-quantified atom |
 * | `(a*b*)*`          | unsafe  | every atom quantified, some unbounded |
 * | `(a+|b+)+`         | unsafe  | an alternative is entirely quantified |
 * | `([a-z]+-)*[a-z]+` | safe    | the mandatory `-` anchors each iteration |
 * | `(a+b)+`           | safe    | the mandatory `b` anchors each iteration |
 *
 * It is a heuristic, not a proof: alternation ambiguity (`(a|a)*`) is not
 * detected. Bounding the work properly needs a linear-time engine, which is a
 * dependency this kernel does not take.
 */

/**
 * Longest accepted `pattern` source. A field pattern is a small anchored shape
 * check; anything this long is itself pathological.
 */
export const MAX_PATTERN_SOURCE_LENGTH = 1000;

/**
 * Cap on the compiled-pattern cache. Patterns come from content-type schemas so
 * the real-world set is tiny; the cap only stops a pathological caller from
 * growing the map without bound.
 */
const MAX_PATTERN_CACHE_ENTRIES = 500;

/** Why a `pattern` rule could not be applied. */
export type PatternRejection = 'invalid' | 'unsafe';

/** A usable compiled pattern, or the reason it is not usable. */
export type CompiledPattern =
    | { readonly regex: RegExp; readonly rejected?: undefined }
    | { readonly regex?: undefined; readonly rejected: PatternRejection };

/** One parsed term: an atom plus the quantifier applied to it, if any. */
interface Term {
    /** Alternatives of a group body; `undefined` for a non-group atom. */
    readonly group?: readonly (readonly Term[])[];
    /** Whether a quantifier is applied to this atom at all. */
    readonly quantified: boolean;
    /** Whether that quantifier is unbounded (`*`, `+`, `{n,}`). */
    readonly unbounded: boolean;
    /** `^` / `$` — a zero-width assertion, not a consuming atom. */
    readonly anchor: boolean;
}

/**
 * A deliberately small regex-source reader: enough structure to know where the
 * groups, the alternations and the quantifiers are, and nothing more. It does
 * not validate the source — {@link compilePattern} leaves that to `RegExp`.
 */
class PatternReader {
    private index = 0;

    constructor(private readonly source: string) {}

    /** Parses alternatives until `)` or end of input. */
    readAlternatives(): readonly (readonly Term[])[] {
        const alternatives: Term[][] = [];
        let current: Term[] = [];
        while (this.index < this.source.length) {
            const char = this.source[this.index];
            if (char === ')') break;
            if (char === '|') {
                this.index += 1;
                alternatives.push(current);
                current = [];
                continue;
            }
            const term = this.readTerm();
            if (term) current.push(term);
        }
        alternatives.push(current);
        return alternatives;
    }

    /** Reads one atom plus its quantifier. */
    private readTerm(): Term | undefined {
        const char = this.source[this.index];
        let group: readonly (readonly Term[])[] | undefined;
        let anchor = false;

        if (char === '(') {
            this.index += 1;
            this.skipGroupPrefix();
            group = this.readAlternatives();
            if (this.source[this.index] === ')') this.index += 1;
        } else if (char === '[') {
            this.skipCharacterClass();
        } else if (char === '\\') {
            // An escape is one atom, whatever it escapes (a trailing lone
            // backslash is invalid source; `RegExp` will reject it).
            this.index += 2;
        } else {
            anchor = char === '^' || char === '$';
            this.index += 1;
        }

        const quantifier = this.readQuantifier();
        return {
            group,
            quantified: quantifier !== undefined,
            unbounded: quantifier === 'unbounded',
            anchor
        };
    }

    /** Skips `?:`, `?=`, `?!`, `?<=`, `?<!`, `?<name>` after a `(`. */
    private skipGroupPrefix(): void {
        if (this.source[this.index] !== '?') return;
        this.index += 1;
        if (this.source[this.index] === '<') {
            const close = this.source.indexOf('>', this.index);
            const next = this.source[this.index + 1];
            if (next === '=' || next === '!') {
                this.index += 2; // lookbehind
                return;
            }
            this.index = close === -1 ? this.source.length : close + 1;
            return;
        }
        this.index += 1; // `:`, `=` or `!`
    }

    /** Skips a `[...]` class, honouring escapes (a `]` may be escaped). */
    private skipCharacterClass(): void {
        this.index += 1; // the `[`
        while (this.index < this.source.length) {
            const char = this.source[this.index];
            if (char === '\\') {
                this.index += 2;
                continue;
            }
            this.index += 1;
            if (char === ']') return;
        }
    }

    /** Reads the quantifier at the cursor, if any, and steps past it. */
    private readQuantifier(): 'bounded' | 'unbounded' | undefined {
        const char = this.source[this.index];
        if (char === '*' || char === '+') {
            this.index += 1;
            this.skipLazyOrPossessive();
            return 'unbounded';
        }
        if (char === '?') {
            this.index += 1;
            this.skipLazyOrPossessive();
            return 'bounded';
        }
        if (char === '{') {
            const close = this.source.indexOf('}', this.index);
            if (close === -1) return undefined; // a literal `{`
            const body = this.source.slice(this.index + 1, close);
            if (!/^\d+(,\d*)?$/.test(body)) return undefined; // a literal `{`
            this.index = close + 1;
            this.skipLazyOrPossessive();
            return /,\s*$/.test(body) ? 'unbounded' : 'bounded';
        }
        return undefined;
    }

    private skipLazyOrPossessive(): void {
        const char = this.source[this.index];
        if (char === '?' || char === '+') this.index += 1;
    }
}

/**
 * Whether an alternative is "all quantified with an unbounded member" — the
 * shape that makes an enclosing unbounded quantifier exponential.
 */
function isAmbiguousAlternative(terms: readonly Term[]): boolean {
    const consuming = terms.filter((term) => !term.anchor);
    if (consuming.length === 0) return false;
    return (
        consuming.every((term) => term.quantified) &&
        consuming.some((term) => term.unbounded)
    );
}

/** Walks the parsed terms looking for a nested-unbounded-quantifier shape. */
function hasCatastrophicShape(
    alternatives: readonly (readonly Term[])[]
): boolean {
    for (const alternative of alternatives) {
        for (const term of alternative) {
            if (!term.group) continue;
            if (term.unbounded && term.group.some(isAmbiguousAlternative))
                return true;
            if (hasCatastrophicShape(term.group)) return true;
        }
    }
    return false;
}

/**
 * Whether `source` risks catastrophic backtracking (or is simply too large to
 * be a sane field pattern). See the module doc for what this does and does not
 * catch.
 */
export function isPotentiallyCatastrophic(source: string): boolean {
    if (source.length > MAX_PATTERN_SOURCE_LENGTH) return true;
    return hasCatastrophicShape(new PatternReader(source).readAlternatives());
}

/** Compiled patterns (and rejections) keyed by source — see {@link compilePattern}. */
const patternCache = new Map<string, CompiledPattern>();

/**
 * Compiles a `pattern` rule, refusing an uncompilable or potentially
 * catastrophic source. Results — including rejections — are cached by source,
 * so the safety analysis and the `RegExp` construction each run once per
 * distinct pattern.
 */
export function compilePattern(source: string): CompiledPattern {
    const cached = patternCache.get(source);
    if (cached) return cached;

    let compiled: CompiledPattern;
    if (isPotentiallyCatastrophic(source)) {
        compiled = { rejected: 'unsafe' };
    } else {
        try {
            compiled = { regex: new RegExp(source) };
        } catch {
            compiled = { rejected: 'invalid' };
        }
    }

    if (patternCache.size >= MAX_PATTERN_CACHE_ENTRIES) patternCache.clear();
    patternCache.set(source, compiled);
    return compiled;
}
