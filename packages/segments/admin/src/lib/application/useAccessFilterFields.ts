import { defineMessages } from 'react-intl';
import {
    FIELD_TYPE,
    OP,
    type FilterEnumValue,
    type FilterField
} from '@orthacms/query-builder-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useSegments } from './hooks';

const messages = defineMessages({
    visible: {
        id: 'segments.filter.visible',
        defaultMessage: 'Can be seen by'
    },
    hidden: {
        id: 'segments.filter.hidden',
        defaultMessage: 'Cannot be seen by'
    },
    // New ids, not the old ones relabelled: `segments.filter.allowed` /
    // `.denied` carried "Can be seen by" / "Cannot be seen by", and a
    // translation of those would now sit on a field that means something else.
    allowed: {
        id: 'segments.filter.restrictedTo',
        defaultMessage: 'Restricted to'
    },
    denied: {
        id: 'segments.filter.excluded',
        defaultMessage: 'Explicitly excluded'
    },
    restricted: {
        id: 'segments.filter.restricted',
        defaultMessage: 'Access restricted'
    },
    group: {
        id: 'segments.filter.group',
        defaultMessage: 'Segmentation'
    }
});

/**
 * The picker heading these three sit under.
 *
 * A `group` on a **flat** field names a plain category rather than a relation
 * (`buildFieldTree` reads the `id` to tell the two apart). Without it they
 * scatter through the collection's own columns, where a reader has to already
 * know the feature exists to recognise "Can be seen by" and "Access restricted"
 * as one thing rather than two odd fields somebody added to the type.
 */
const GROUP = [messages.group] as const;

/**
 * The wire names, matching `ACCESS_FILTER_FIELD` in `@orthacms/segments-server`.
 * They are the SQL whitelist's keys, so the two sides must agree exactly.
 */
const FIELD = {
    Visible: 'audienceVisible',
    Hidden: 'audienceHidden',
    Allowed: 'audienceAllowed',
    Denied: 'audienceDenied',
    Restricted: 'accessRestricted'
} as const;

/**
 * How many audiences the picker offers.
 *
 * The server's page cap. Past it the field lists the first hundred by label
 * rather than refusing to render — a filter over a subset is still useful, and
 * an installation with more than a hundred audiences is one where the useful
 * question is "restricted at all", which is the third field.
 */
const PICKER_LIMIT = 100;

/**
 * The access filter fields contributed to the records query-builder
 * (`RECORDS_FILTER_FIELDS_SLOT`), in two pairs plus a boolean:
 *
 * - **Can be seen by** / **Cannot be seen by** — what a reader in that audience
 *   gets, by the server's `canRead`: an entry open to everyone *can* be seen by
 *   Acme, and one restricted to Globex alone *cannot*, though no list names
 *   Acme. These used to be the labels of the list fields below, and so missed
 *   every open entry — the most common way to be visible.
 * - **Restricted to** / **Explicitly excluded** — what the entry's own allow and
 *   deny lists say (the Access tab's "Can see" / "Cannot see"). Same wire
 *   names as before, so saved views and alarm rules keep their meaning and only
 *   gain an honest label.
 * - **Access restricted** — whether the entry names any audience at all.
 *
 * The audience fields are enums of the workspace's audiences.
 * Resolved server-side by the segments plugin's virtual-field subqueries, so
 * "every article Acme can read" is one rule in the same filter tree as
 * everything else, saveable as a view and replayable as an alarm rule.
 *
 * Empty until the audiences load, and empty for a workspace that is offered
 * none — a field whose value list is empty is a rule nobody can complete.
 *
 * **Scoped to the open workspace**, like the entry editor's tab: filtering by an
 * audience this workspace was never offered would be a question about content it
 * cannot restrict that way.
 *
 * The operator sets are deliberately narrow, and the omission of negation is the
 * important one: `ne` would negate *inside* the subquery — "has some allowed
 * audience other than Acme" — which an entry that also allows Acme satisfies.
 * That reads as "not visible to Acme" and is not it. Offering it would build
 * rules the server refuses, which reaches the user as "couldn't load this
 * collection" over a rule the picker itself proposed.
 */
export function useAccessFilterFields(): FilterField[] {
    const workspace = useCurrentWorkspace();
    const segments = useSegments({
        workspaceId: workspace.id,
        pageSize: PICKER_LIMIT
    });

    const items = segments.data?.items ?? [];
    if (!items.length) return [];

    const enumValues: FilterEnumValue[] = items.map((segment) => ({
        // The **id**, because that is what an entry's lists hold and what the
        // server matches — a key can be renamed without touching either.
        value: segment.id,
        label: {
            id: `segments.filter.audience.${segment.id}`,
            defaultMessage: segment.label
        }
    }));

    // `is one of` is **any of** on every audience field, matching the server.
    // "Both" is an `and` of two `equals` rules, which the builder composes —
    // one operator with two readings is the thing nobody could keep straight.
    //
    // It leads, so it is what picking a field opens with: the question is
    // *which audiences*, and the multi-select answers the one-audience case
    // too. Led by `equals`, naming a second audience meant first discovering
    // there was a second operator.
    const audienceField = (
        id: string,
        label: (typeof messages)[keyof typeof messages]
    ): FilterField => ({
        id,
        label,
        group: GROUP,
        type: FIELD_TYPE.Enum,
        operators: [OP.IsOneOf, OP.Equals],
        enumValues
    });

    return [
        audienceField(FIELD.Visible, messages.visible),
        audienceField(FIELD.Hidden, messages.hidden),
        audienceField(FIELD.Allowed, messages.allowed),
        audienceField(FIELD.Denied, messages.denied),
        {
            id: FIELD.Restricted,
            label: messages.restricted,
            group: GROUP,
            // "Does this entry name any audience at all" — the question an
            // editor asks before publishing a batch, and the one that stays
            // answerable however many audiences exist.
            type: FIELD_TYPE.Boolean,
            operators: [OP.Equals]
        }
    ];
}
