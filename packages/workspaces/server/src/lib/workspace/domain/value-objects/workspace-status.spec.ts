import { WorkspaceStatus, WORKSPACE_STATUSES } from './workspace-status';
import { InvalidWorkspaceStatusError } from '../errors';

describe('WorkspaceStatus', () => {
    describe('create', () => {
        it.each([...WORKSPACE_STATUSES])('accepts %s', (key) => {
            expect(WorkspaceStatus.create(key).value).toBe(key);
        });

        it.each([
            ['an unknown key', 'deleted'],
            ['empty', ''],
            ['wrong case', 'Active'],
            ['a boolean-ish string', 'true']
        ])('rejects %s', (_label, value) => {
            expect(() => WorkspaceStatus.create(value)).toThrow(
                InvalidWorkspaceStatusError
            );
        });
    });

    describe('the two states', () => {
        it('builds active, which is not archived', () => {
            const status = WorkspaceStatus.active();

            expect(status.value).toBe('active');
            expect(status.isArchived).toBe(false);
        });

        it('builds archived', () => {
            const status = WorkspaceStatus.archived();

            expect(status.value).toBe('archived');
            expect(status.isArchived).toBe(true);
        });

        it('has exactly these two — archiving is soft, there is no deleted state', () => {
            // A workspace is either live or archived; deletion removes the row
            // rather than moving it to a third status.
            expect([...WORKSPACE_STATUSES]).toEqual(['active', 'archived']);
        });
    });

    describe('equals', () => {
        it('is structural across separately-built instances', () => {
            expect(
                WorkspaceStatus.active().equals(
                    WorkspaceStatus.create('active')
                )
            ).toBe(true);
        });

        it('separates the two states', () => {
            expect(
                WorkspaceStatus.active().equals(WorkspaceStatus.archived())
            ).toBe(false);
        });
    });
});
