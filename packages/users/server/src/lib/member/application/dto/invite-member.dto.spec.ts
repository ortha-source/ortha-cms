import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InviteMemberDto } from './invite-member.dto';

/**
 * `InviteMemberDto.name` — the same trim-then-validate chain as the update DTO,
 * and the one place the two deliberately differ.
 *
 * Invite gates on `@IsOptional()`, which skips the rest of the chain for `null`
 * as well as `undefined`. That is correct **here** and wrong on the patch: an
 * invite has no stored name to clear, and `InviteMemberUseCase` collapses the
 * two spellings itself (`name: dto.name ?? null`,
 * `invite-member.use-case.ts:57`), so a `null` and an omitted name reach
 * `Member.invite` as the same value. The patch instead tests presence with
 * `!== undefined`, so a `null` there is a *distinct* instruction — which is why
 * it validates on one DTO and 400s on the other. Pinned so nobody
 * "harmonises" the pair by making them agree.
 */
describe('InviteMemberDto', () => {
    /** A valid invite body, overridden field by field. */
    function payload(overrides: Record<string, unknown> = {}) {
        return {
            email: 'grace@example.com',
            role: 'contributor',
            ...overrides
        };
    }

    /** The instance produced by transforming `body`. */
    function transform(body: Record<string, unknown>): InviteMemberDto {
        return plainToInstance(InviteMemberDto, body);
    }

    /** The constraint names that failed on `name`, `[]` when it validated. */
    async function nameFailures(
        body: Record<string, unknown>
    ): Promise<string[]> {
        const errors = await validate(transform(body));
        const nameError = errors.find((error) => error.property === 'name');
        return Object.keys(nameError?.constraints ?? {});
    }

    it('rejects a whitespace-only name — trimmed first, so isNotEmpty sees it', async () => {
        expect(await nameFailures(payload({ name: '   ' }))).toEqual([
            'isNotEmpty'
        ]);
    });

    it('rejects an empty name', async () => {
        expect(await nameFailures(payload({ name: '' }))).toEqual([
            'isNotEmpty'
        ]);
    });

    it('accepts a padded name and stores it trimmed', async () => {
        expect(await nameFailures(payload({ name: ' Grace ' }))).toEqual([]);
        expect(transform(payload({ name: ' Grace ' })).name).toBe('Grace');
    });

    it('accepts an omitted name — the invitee can set one on accept', async () => {
        expect(await nameFailures(payload())).toEqual([]);
    });

    it('rejects a non-string name', async () => {
        expect(await nameFailures(payload({ name: 42 }))).toContain('isString');
    });

    it('tolerates an explicit null name, unlike the patch DTO', async () => {
        // `@IsOptional()` short-circuits on `null`, and the use case reads
        // `dto.name ?? null` — so `null` and "omitted" are indistinguishable by
        // the time they reach the aggregate. The update DTO 400s the same
        // input on purpose; the difference is the contract, not an oversight.
        expect(await nameFailures(payload({ name: null }))).toEqual([]);
        expect(transform(payload({ name: null })).name ?? null).toBeNull();
        expect(transform(payload()).name ?? null).toBeNull();
    });

    it('requires a well-formed email and a known role', async () => {
        const errors = await validate(
            transform({ email: 'not-an-email', role: 'sovereign' })
        );
        expect(errors.map((error) => error.property).sort()).toEqual([
            'email',
            'role'
        ]);
    });
});
