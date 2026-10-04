import { compilePattern } from '../../validation/safe-pattern';
import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/**
 * A pattern must compile, and must not be one validation would refuse to run
 * (`compilePattern` — catastrophic backtracking). The same function decides at
 * validation time, so a pattern this accepts is one the server will apply.
 */
export const checkPattern: FieldRule = (type, name, field) => {
    if (field.pattern === undefined) return [];
    const compiled = compilePattern(field.pattern);
    if ('regex' in compiled) return [];
    const why =
        compiled.rejected === 'unsafe'
            ? 'could take very long to run on some input'
            : 'is not a valid regular expression';
    return [
        issue(
            fieldPath(type.name, name),
            'field.pattern',
            `Field "${type.name}.${name}" has pattern ${JSON.stringify(field.pattern)}, which ${why}.`
        )
    ];
};
