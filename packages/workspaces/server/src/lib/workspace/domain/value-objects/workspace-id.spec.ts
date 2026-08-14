import { WorkspaceId } from './workspace-id';
import { InvalidWorkspaceIdError } from '../errors';

const UUID = '6b2f9a03-4c17-4e58-a3d9-77c0e1b48f52';

describe('WorkspaceId', () => {
    describe('create', () => {
        it('accepts a lowercase uuid', () => {
            expect(WorkspaceId.create(UUID).value).toBe(UUID);
        });

        it('accepts uppercase hex and preserves it verbatim', () => {
            // The guard's route pattern is case-insensitive too, and Postgres
            // normalises uuids on comparison — so an uppercase id must survive
            // the whole path rather than 400 at the boundary (EC-41).
            const upper = UUID.toUpperCase();

            expect(WorkspaceId.create(upper).value).toBe(upper);
        });

        it.each([
            ['not a uuid', 'workspace-1'],
            ['empty', ''],
            ['a uuid with surrounding space', ` ${UUID} `],
            ['too short', '6b2f9a03-4c17-4e58-a3d9'],
            ['wrong separators', '6b2f9a034c174e58a3d977c0e1b48f52'],
            ['non-hex characters', '6b2f9a03-4c17-4e58-a3d9-77c0e1b48fzz']
        ])('rejects %s', (_label, value) => {
            expect(() => WorkspaceId.create(value)).toThrow(
                InvalidWorkspaceIdError
            );
        });
    });

    describe('generate', () => {
        it('mints a valid id the aggregate can own before any insert', () => {
            const id = WorkspaceId.generate();

            // Round-tripping proves the minted shape passes its own validator —
            // the id has to be assignable here so `workspace.created` can carry
            // it, rather than being read back from a database default.
            expect(() => WorkspaceId.create(id.value)).not.toThrow();
        });

        it('does not repeat', () => {
            const ids = new Set(
                Array.from({ length: 50 }, () => WorkspaceId.generate().value)
            );

            expect(ids.size).toBe(50);
        });
    });

    describe('equals', () => {
        it('is structural, not reference', () => {
            expect(
                WorkspaceId.create(UUID).equals(WorkspaceId.create(UUID))
            ).toBe(true);
        });

        it('separates different ids', () => {
            expect(
                WorkspaceId.create(UUID).equals(WorkspaceId.generate())
            ).toBe(false);
        });

        it('is case-sensitive on the raw value', () => {
            // Documenting the sharp edge rather than asserting it is desirable:
            // two ids Postgres treats as equal compare false here, so domain
            // code must not rely on `equals` for ids that crossed the DB.
            expect(
                WorkspaceId.create(UUID).equals(
                    WorkspaceId.create(UUID.toUpperCase())
                )
            ).toBe(false);
        });
    });
});
