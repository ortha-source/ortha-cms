import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { ssoIdentities, users } from '@orthacms/identity-server';
import type { MemberSignInView } from '../../application/queries/member.view';

/**
 * Read model for **how** a member signs in: whether a password is set and
 * which SSO providers are linked. Two facts about the credential, never the
 * credential — `password_hash` is only ever tested for `NULL` here, and an SSO
 * row contributes its provider's name, not its subject or address.
 */
@Injectable()
export class MemberSignInQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** The member's sign-in methods, or `null` when no such member exists. */
    async byId(id: string): Promise<MemberSignInView | null> {
        const [user] = await this.db
            .select({ passwordHash: users.passwordHash })
            .from(users)
            .where(eq(users.id, id));
        if (!user) {
            return null;
        }
        const providers = await this.db
            .select({ provider: ssoIdentities.provider })
            .from(ssoIdentities)
            .where(eq(ssoIdentities.userId, id))
            .orderBy(asc(ssoIdentities.provider));
        return {
            hasPassword: user.passwordHash !== null,
            ssoProviders: providers.map((row) => row.provider)
        };
    }
}
