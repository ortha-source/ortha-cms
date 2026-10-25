import {
    ACTIVITY_KINDS,
    ACTIVITY_SUBJECT_TYPES
} from '../../types/activityKinds';
import { ACTION_MESSAGES, SUBJECT_TYPE_MESSAGES } from '../activityMessages';
import { ACTIVITY_FILTER_FIELDS, activityFilterFieldsWith } from './index';

/**
 * ORT-205 · `[activity:I-38]` — the filter offers what the table shows.
 *
 * The Action column renders "Published content"; the value on the wire is
 * `entry.published`. As a free-text field the filter asked the reader to type
 * the second while looking at the first, which is only possible for somebody
 * who already knows the internal vocabulary — so the whole column was
 * effectively unfilterable from the UI. The same for Subject, whose values are
 * snake-cased machine tokens.
 *
 * The server-side half of this pair (`activity-filter.spec.ts`) checks the
 * *field list* against the whitelist. What it cannot see is the vocabulary: an
 * enum with the right id and half the options passes it and still hides most of
 * the log. Both assertions below are about that, and both are about the labels
 * coming from the **same** map the cells render from — two maps would be two
 * places for one row to be named differently.
 */
const fieldFor = (id: string) => {
    const field = ACTIVITY_FILTER_FIELDS.find((entry) => entry.id === id);
    if (!field) {
        throw new Error(
            `No "${id}" field in ACTIVITY_FILTER_FIELDS. If it was renamed, ` +
                'update this test and the server schema together rather than ' +
                'dropping the check.'
        );
    }
    return field;
};

describe('the activity filter surface', () => {
    describe('the Action filter', () => {
        const kind = () => fieldFor('kind');

        it('offers the whole kind vocabulary rather than free text [activity:I-38]', () => {
            expect(kind().type).toBe('enum');
            expect(kind().enumValues?.map((option) => option.value)).toEqual([
                ...ACTIVITY_KINDS
            ]);
        });

        it('labels each kind from the map the Action cell renders from [activity:I-38]', () => {
            for (const option of kind().enumValues ?? []) {
                expect(option.label).toBe(
                    ACTION_MESSAGES[
                        option.value as (typeof ACTIVITY_KINDS)[number]
                    ]
                );
            }
        });
    });

    describe('the Subject type filter', () => {
        const subjectType = () => fieldFor('subjectType');

        it('offers the whole subject-type vocabulary [activity:I-38]', () => {
            expect(subjectType().type).toBe('enum');
            expect(
                subjectType().enumValues?.map((option) => option.value)
            ).toEqual([...ACTIVITY_SUBJECT_TYPES]);
        });

        it('labels each subject type from the map the Subject cell renders from [activity:I-38]', () => {
            for (const option of subjectType().enumValues ?? []) {
                expect(option.label).toBe(
                    SUBJECT_TYPE_MESSAGES[
                        option.value as (typeof ACTIVITY_SUBJECT_TYPES)[number]
                    ]
                );
            }
        });
    });

    /**
     * The four that stay open: an email, two ids and a timestamp have no closed
     * vocabulary to offer, and turning one into an enum would be a list of
     * every actor the deployment has ever had.
     */
    it('leaves the open-ended fields as free input', () => {
        for (const id of ['actorEmail', 'actorId', 'subjectId', 'at']) {
            expect(`${id}: ${fieldFor(id).type}`).not.toBe(`${id}: enum`);
        }
    });

    // Display only, but the words are what a reader searches the picker for —
    // and they used to be "Kind" and "Time" against columns headed "Action" and
    // "When".
    it('names the fields the way the table heads its columns', () => {
        expect(fieldFor('kind').label.defaultMessage).toBe('Action');
        expect(fieldFor('at').label.defaultMessage).toBe('When');
    });
});

describe('the workspace, offered by name', () => {
    const names = new Map([
        ['22222222-2222-4222-8222-222222222222', 'Product docs'],
        ['11111111-1111-4111-8111-111111111111', 'Marketing {site}']
    ]);

    it('stays the plain uuid field until the names are known', () => {
        expect(activityFilterFieldsWith(undefined)).toBe(
            ACTIVITY_FILTER_FIELDS
        );
        expect(activityFilterFieldsWith(new Map())).toBe(
            ACTIVITY_FILTER_FIELDS
        );
    });

    it('becomes a vocabulary of names over the same wire field [activity:I-37] [activity:I-38]', () => {
        const fields = activityFilterFieldsWith(names);
        expect(fields.map((field) => field.id)).toEqual(
            ACTIVITY_FILTER_FIELDS.map((field) => field.id)
        );
        const workspace = fields.find((field) => field.id === 'workspaceId');
        expect(workspace?.type).toBe('enum');
        expect(workspace?.label.defaultMessage).toBe('Workspace');
        // Sorted by name; the value on the wire is still the id.
        expect(workspace?.enumValues?.map((option) => option.value)).toEqual([
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222'
        ]);
    });

    it('escapes a name so ICU syntax in it is read as text', () => {
        const workspace = activityFilterFieldsWith(names).find(
            (field) => field.id === 'workspaceId'
        );
        expect(workspace?.enumValues?.[0].label.defaultMessage).toBe(
            "Marketing '{'site'}'"
        );
    });
});
