import { checkFieldWidth } from './check-field-width';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'event',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};

describe('checkFieldWidth', () => {
    it.each([undefined, 'half', 'full'])('accepts %j', (width) => {
        expect(
            checkFieldWidth(
                type,
                'startsAt',
                { type: 'datetime', required: false, width },
                pass
            )
        ).toEqual([]);
    });

    it('rejects anything else', () => {
        const [found] = checkFieldWidth(
            type,
            'startsAt',
            { type: 'datetime', required: false, width: 'halff' },
            pass
        );
        expect(found.message).toBe(
            'Field "event.startsAt" has admin.width "halff" — use \'half\' or \'full\'.'
        );
    });
});
