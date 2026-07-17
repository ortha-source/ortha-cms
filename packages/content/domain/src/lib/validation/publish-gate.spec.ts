import { CONTENT_FIELD_TYPE } from '../fields/field-type';
import type { EntryFieldSpecMap } from '../fields/field-spec';
import { canPublish } from './publish-gate';

const fields: EntryFieldSpecMap = {
    title: {
        type: CONTENT_FIELD_TYPE.Text,
        required: true,
        validation: { minLength: 3 }
    },
    count: {
        type: CONTENT_FIELD_TYPE.Number,
        required: false,
        validation: { min: 1 }
    }
};

describe('canPublish (publish gate)', () => {
    it('is false while a required field is empty', () => {
        expect(canPublish(fields, { count: 2 })).toBe(false);
    });

    it('is false when a present value is invalid', () => {
        expect(canPublish(fields, { title: 'no', count: 0 })).toBe(false);
    });

    it('is true when every required field is present and valid', () => {
        expect(canPublish(fields, { title: 'hello', count: 2 })).toBe(true);
    });

    it('is true when an optional field is simply absent', () => {
        expect(canPublish(fields, { title: 'hello' })).toBe(true);
    });
});
