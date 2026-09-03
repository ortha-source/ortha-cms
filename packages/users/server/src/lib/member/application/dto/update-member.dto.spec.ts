import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMemberDto } from './update-member.dto';

/**
 * `UpdateMemberDto.name` — the trim-then-validate chain, and the `null` hole it
 * closes.
 *
 * The trim is the interesting half: `@IsNotEmpty` rejects `''` but accepts
 * `'   '`, and this row is the only source of a person's human identifier, so a
 * whitespace name leaves the members table, the avatar initials and the audit
 * log's actor column with nothing to render (508 §504.2). Asserting the *value*
 * on the instance, not just that validation passed, is what proves the
 * `@Transform` is applied rather than merely consulted.
 */
describe('UpdateMemberDto', () => {
    /** The instance produced by transforming `payload`. */
    function transform(payload: Record<string, unknown>): UpdateMemberDto {
        return plainToInstance(UpdateMemberDto, payload);
    }

    /** The constraint names that failed on `name`, `[]` when it validated. */
    async function nameFailures(
        payload: Record<string, unknown>
    ): Promise<string[]> {
        const errors = await validate(transform(payload));
        const nameError = errors.find((error) => error.property === 'name');
        return Object.keys(nameError?.constraints ?? {});
    }

    it('rejects a whitespace-only name — trimmed first, so isNotEmpty sees it [users:I-11]', async () => {
        expect(await nameFailures({ name: '   ' })).toEqual(['isNotEmpty']);
    });

    it('rejects an empty name', async () => {
        expect(await nameFailures({ name: '' })).toEqual(['isNotEmpty']);
    });

    it('accepts a padded name and stores it trimmed', async () => {
        expect(await nameFailures({ name: ' Grace ' })).toEqual([]);
        // The point of the @Transform: the trimmed value is what the use case
        // hands the aggregate, not just what the validator inspected.
        expect(transform({ name: ' Grace ' }).name).toBe('Grace');
    });

    it('accepts an omitted name — every field on a patch is optional', async () => {
        expect(await nameFailures({ role: 'viewer' })).toEqual([]);
    });

    it('rejects a non-string name', async () => {
        expect(await nameFailures({ name: 42 })).toContain('isString');
    });

    it('rejects an explicit null name', async () => {
        // `@IsOptional()` would skip the whole chain for `null` as well as
        // `undefined`, and on a *patch* those are not the same thing: the use
        // case tests presence with `dto.name !== undefined`, so a `null` that
        // validated reached `member.rename(null)` and cleared the stored name —
        // the exact blank the `''` / `'   '` cases reject. `@ValidateIf(name
        // !== undefined)` lets `@IsString` see the `null` and turn it into the
        // 400 it always should have been.
        expect(await nameFailures({ name: null })).toContain('isString');
    });

    it('validates role independently of name', async () => {
        const errors = await validate(transform({ role: 'sovereign' }));
        expect(errors.map((error) => error.property)).toEqual(['role']);
    });
});
