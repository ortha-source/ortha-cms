import { GetWorkspaceArchiveImpactController } from './get-workspace-archive-impact.controller';
import type { ArchiveImpactQuery } from '../../infrastructure/queries/archive-impact.query';

describe('GetWorkspaceArchiveImpactController', () => {
    it('answers with the read model’s counts for the guarded id', async () => {
        const forWorkspace = jest.fn().mockResolvedValue({
            records: 318,
            members: 2,
            linkedWorkspaces: 2
        });
        const controller = new GetWorkspaceArchiveImpactController({
            forWorkspace
        } as unknown as ArchiveImpactQuery);

        await expect(
            controller.get('11111111-1111-4111-8111-111111111111')
        ).resolves.toEqual({ records: 318, members: 2, linkedWorkspaces: 2 });
        expect(forWorkspace).toHaveBeenCalledWith(
            '11111111-1111-4111-8111-111111111111'
        );
    });
});
