import { ListSuggestionsController } from './list-suggestions.controller';
import type { CapabilityProfileService } from '../../application/capability-profile.service';
import type { ContentTypeSummaryService } from '../../application/content-type-summary.service';
import type { SkillCatalogService } from '../../../skills/application/skill-catalog.service';
import type { PublicUser } from '@orthacms/identity-server';

describe('ListSuggestionsController', () => {
    const user = {
        id: 'user-1',
        email: 'amara@orthacms.dev',
        roleId: 'role-editor'
    } as PublicUser;

    function controller(skillsEnabled = true) {
        const profiles = {
            resolve: jest.fn(async () => ({
                profile: {
                    tools: [
                        { name: 'admin_content_search' },
                        { name: 'content_propose_bulk_save' }
                    ],
                    withheld: []
                },
                context: {}
            }))
        };
        const types = {
            grantedTypes: jest.fn(async () => [
                {
                    name: 'article',
                    label: 'Articles',
                    kind: 'collection',
                    owned: true
                }
            ])
        };
        const skills = {
            catalogue: jest.fn(async () => [
                {
                    id: 's1',
                    name: 'seo-checklist',
                    title: 'SEO checklist',
                    description: 'What to check before publishing.',
                    mode: 'manual',
                    source: 'cms',
                    enabled: skillsEnabled,
                    editable: true
                }
            ])
        };
        return {
            profiles,
            types,
            skills,
            controller: new ListSuggestionsController(
                profiles as unknown as CapabilityProfileService,
                types as unknown as ContentTypeSummaryService,
                skills as unknown as SkillCatalogService
            )
        };
    }

    it('builds from the caller’s own tools, in the guarded workspace', async () => {
        const { controller: subject, profiles, types, skills } = controller();

        const suggestions = await subject.list(user, 'workspace-1');

        expect(profiles.resolve).toHaveBeenCalledWith(
            {
                id: 'user-1',
                email: 'amara@orthacms.dev',
                roleId: 'role-editor'
            },
            'workspace-1'
        );
        expect(types.grantedTypes).toHaveBeenCalledWith('workspace-1');
        expect(skills.catalogue).toHaveBeenCalledWith('workspace-1');
        expect(suggestions.map((s) => s.kind)).toEqual([
            'missing-summary',
            'check-skill',
            'content-types'
        ]);
    });

    it('leaves a switched-off skill out of the openers', async () => {
        const suggestions = await controller(false).controller.list(
            user,
            'workspace-1'
        );

        expect(suggestions.some((s) => s.kind === 'check-skill')).toBe(false);
    });
});
