import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { UpdateWorkspaceDto } from './update-workspace.dto';
import { WORKSPACE_COLORS } from '../../domain/value-objects/workspace-color';

/**
 * The host's pipe: `whitelist` strips unknown properties and
 * `forbidNonWhitelisted` turns them into a 400 instead. Validating with the
 * same options is what makes "the DTO has no `slug`" an assertion about the
 * wire rather than about the class.
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

/** The constraint names that failed on `property`, `[]` when it validated. */
async function failuresOn(
    payload: Record<string, unknown>,
    property: string
): Promise<string[]> {
    const errors: ValidationError[] = await validate(
        plainToInstance(UpdateWorkspaceDto, payload),
        PIPE_OPTIONS
    );
    const failed = errors.find((error) => error.property === property);
    return Object.keys(failed?.constraints ?? {});
}

/**
 * `PATCH /api/workspaces/:id` edits a workspace's *profile* — and deliberately
 * nothing else.
 *
 * The slug is the workspace's stable URL identifier, so it is absent from this
 * DTO rather than merely ignored by the use case. That distinction is the
 * whole test: an ignored field looks like a silent success to the client that
 * sent it, while an absent one is a 400 under the host's
 * `forbidNonWhitelisted` pipe. Status changes are likewise routed away, to the
 * dedicated archive/unarchive endpoints.
 *
 * A note on where each rule lives, because the two halves are not symmetrical.
 * The **format** rule for a slug (lowercase letters, digits, hyphens) is
 * enforced by the `Slug` value object and by nothing else — create's DTO
 * carries only `@IsString() @MaxLength(120)` in front of it. So "checked by the
 * value object, not by a decorator" is true of the format, not of the length:
 * a 200-character slug is rejected by the decorator before `Slug.create` ever
 * sees it. The **color** rule is the reverse — `@IsIn(WORKSPACE_COLORS)` here,
 * against the same catalogue `WorkspaceColor` validates, so a bad color is a
 * 400 from the pipe rather than a 400 translated out of a domain error.
 */
describe('UpdateWorkspaceDto', () => {
    describe('the slug is not editable here', () => {
        it('has no slug property at all [workspaces:I-13]', () => {
            expect('slug' in new UpdateWorkspaceDto()).toBe(false);
        });

        it('rejects a body carrying one', async () => {
            expect(
                await failuresOn({ slug: 'renamed-workspace' }, 'slug')
            ).toEqual(['whitelistValidation']);
        });

        it('rejects it even alongside fields that are editable', async () => {
            // The realistic shape of the mistake: a client that PATCHes the
            // whole form back, slug included.
            expect(
                await failuresOn({ name: 'Growth', slug: 'growth' }, 'slug')
            ).toEqual(['whitelistValidation']);
        });

        it('rejects a status change too — archiving has its own routes', async () => {
            expect(await failuresOn({ status: 'archived' }, 'status')).toEqual([
                'whitelistValidation'
            ]);
        });
    });

    describe('color', () => {
        it.each([...WORKSPACE_COLORS])('accepts %s', async (color) => {
            expect(await failuresOn({ color }, 'color')).toEqual([]);
        });

        it.each([
            ['an unlisted key', 'crimson'],
            ['a css color', '#ff0000'],
            ['the wrong case', 'Slate'],
            ['an empty string', '']
        ])('rejects %s', async (_label, color) => {
            // Stored as plain text (the server can't depend on the admin
            // palette), so the enum check here is the only thing standing
            // between a typo and an avatar that renders with no tint at all.
            expect(await failuresOn({ color }, 'color')).toEqual(['isIn']);
        });

        it('accepts an omitted color — every field on a patch is optional', async () => {
            expect(await failuresOn({ name: 'Growth' }, 'color')).toEqual([]);
        });
    });

    describe('the profile fields it does carry', () => {
        it('accepts an entirely empty patch', async () => {
            expect(
                await validate(
                    plainToInstance(UpdateWorkspaceDto, {}),
                    PIPE_OPTIONS
                )
            ).toEqual([]);
        });

        it('rejects an empty name', async () => {
            expect(await failuresOn({ name: '' }, 'name')).toContain(
                'isNotEmpty'
            );
        });

        it('accepts an empty description — that is how it is cleared', async () => {
            expect(
                await failuresOn({ description: '' }, 'description')
            ).toEqual([]);
        });

        it('rejects an over-long name and description', async () => {
            expect(
                await failuresOn({ name: 'a'.repeat(121) }, 'name')
            ).toContain('maxLength');
            expect(
                await failuresOn(
                    { description: 'a'.repeat(2001) },
                    'description'
                )
            ).toContain('maxLength');
        });
    });
});
