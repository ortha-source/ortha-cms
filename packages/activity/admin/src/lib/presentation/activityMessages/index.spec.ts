import type { IntlShape, MessageDescriptor } from 'react-intl';
import { ACTIVITY_KINDS } from '../../types/activityKinds';
import { ACTION_MESSAGES, formatActivityAction } from './index';

/**
 * The admin's two catalogues, against each other.
 *
 * `audit-event-mapping.spec.ts` (server side) already pins this package's
 * `ACTIVITY_KINDS` against the server's `AUDIT_KINDS` in both directions, so a
 * kind the server can write and the admin has never heard of is a failing test.
 * What nothing checked is the step *after* that: a kind can be in
 * `ACTIVITY_KINDS` — the filter offers it, the type accepts it — and still have
 * no label, at which point the Action column prints the raw dotted wire token.
 *
 * The type is what is supposed to prevent it: `ACTION_MESSAGES` is declared
 * `Record<ActivityKind, MessageDescriptor>`, so a missing key is a compile
 * error and an extra one is an excess-property error. That guarantee is only as
 * good as the annotation, and widening it to `Record<string, …>` — the obvious
 * thing to do when the errors get annoying — is a one-word change that no test
 * would have noticed. So the same equality is asserted here at runtime, where
 * the annotation is not what carries it.
 */

/** Enough of an `IntlShape` for `formatActivityAction`: it formats and nothing else. */
const intl = {
    formatMessage: (descriptor: MessageDescriptor) =>
        String(descriptor.defaultMessage)
} as unknown as IntlShape;

describe('the Action label catalogue', () => {
    it('labels every kind the log can render, and nothing else [activity:I-26]', () => {
        expect(Object.keys(ACTION_MESSAGES).sort()).toEqual(
            [...ACTIVITY_KINDS].sort()
        );
    });

    it('never falls back to the raw wire token for a known kind [activity:I-26]', () => {
        // The consequence, through the production function rather than through
        // the map: `formatActivityAction` answers with `kind` itself when it
        // finds no descriptor, which is a silent failure on screen — the cell
        // fills, it just says `media.asset.uploaded`.
        const raw = ACTIVITY_KINDS.filter(
            (kind) => formatActivityAction(intl, kind) === kind
        );

        expect(`unlabelled: ${raw.join(', ')}`).toBe('unlabelled: ');
    });

    it('gives each kind its own label, so two actions never read alike [activity:I-26]', () => {
        // Completeness alone is satisfiable by pointing every kind at one
        // descriptor. A duplicate here means two distinct actions are
        // indistinguishable in the Action column — the same defect the catalogue
        // exists to prevent, arrived at from the other side.
        const labels = ACTIVITY_KINDS.map((kind) =>
            formatActivityAction(intl, kind)
        );
        const duplicates = labels.filter(
            (label, index) => labels.indexOf(label) !== index
        );

        expect([...new Set(duplicates)]).toEqual([]);
    });
});
