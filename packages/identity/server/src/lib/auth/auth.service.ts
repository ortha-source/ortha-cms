import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { users } from '../schema';
import { hashPassword, verifyPassword } from './password';
import {
    SessionService,
    type CreatedSession,
    type SessionContext
} from './session.service';
import { InvalidCredentialsError } from './errors';

/** The current user as exposed by `GET /auth/me` — never includes the hash. */
export interface PublicUser {
    /** User id. */
    id: string;
    /** Login email (as stored). */
    email: string;
    /** The user's single global role id. */
    roleId: string;
    /** Account lifecycle state. */
    status: (typeof users.status.enumValues)[number];
}

/**
 * Email/password authentication. Verifies credentials and, on success, opens
 * a server-side session via {@link SessionService}. Owns no transport concern
 * — it returns/throws plain values; the controller maps them to HTTP.
 */
@Injectable()
export class AuthService {
    /**
     * A throwaway bcrypt hash, computed once, used to equalize verify timing
     * when the user (or their hash) is absent — so a missing account can't be
     * told from a wrong password by response time (defeats timing-based
     * enumeration on top of the generic error).
     */
    private dummyHash: Promise<string> | null = null;

    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly sessions: SessionService
    ) {}

    /**
     * Verifies `email`/`password` and opens a session on success. Every
     * failure — unknown email, invite-pending (null hash), non-active status,
     * or wrong password — throws the same {@link InvalidCredentialsError} and
     * performs one bcrypt comparison, so neither the response body nor its
     * timing leaks which accounts exist (FR-3, no user enumeration).
     */
    async login(
        email: string,
        password: string,
        context?: SessionContext
    ): Promise<CreatedSession> {
        const [user] = await this.db
            .select({
                id: users.id,
                passwordHash: users.passwordHash,
                status: users.status
            })
            .from(users)
            .where(eq(sql`lower(${users.email})`, email.toLowerCase()));

        // Always run a comparison, even with no user/hash, to hold timing flat.
        const hashed = user?.passwordHash ?? (await this.getDummyHash());
        const passwordOk = await verifyPassword(hashed, password);

        if (!user || !user.passwordHash || user.status !== 'active' || !passwordOk) {
            throw new InvalidCredentialsError();
        }

        return this.sessions.create(user.id, context);
    }

    /**
     * Resolves an opaque session id to the current {@link PublicUser}, or
     * `null` when the session is invalid or its user has vanished. The hash
     * is never selected, so it cannot leak through this path.
     */
    async currentUser(sessionId: string): Promise<PublicUser | null> {
        const session = await this.sessions.findValid(sessionId);
        if (!session) {
            return null;
        }

        const [user] = await this.db
            .select({
                id: users.id,
                email: users.email,
                roleId: users.roleId,
                status: users.status
            })
            .from(users)
            .where(eq(users.id, session.userId));

        return user ?? null;
    }

    private getDummyHash(): Promise<string> {
        if (!this.dummyHash) {
            this.dummyHash = hashPassword(randomBytes(32).toString('hex'));
        }
        return this.dummyHash;
    }
}
