import { Inject, Injectable, Logger } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import {
    normalizeSsoProfile,
    assertSsoProfile,
    SSO_REGISTRY,
    SsoVerificationError,
    type SsoCallback,
    type SsoProfile,
    type SsoProvider,
    type SsoRegistry
} from '@orthacms/identity-domain';
import {
    IDENTITY_EVENT_KINDS,
    identityEvent
} from '../../domain/events/identity-events';
import type { SessionContext } from '../../domain/session';
import {
    SESSION_REPOSITORY,
    type CreatedSession,
    type SessionRepository
} from '../../domain/session.repository';
import {
    SSO_AUTH_REQUEST_REPOSITORY,
    type SsoAuthRequestRepository
} from '../../domain/sso-auth-request.repository';
import {
    SSO_IDENTITY_REPOSITORY,
    type SsoIdentityRepository
} from '../../domain/sso-identity.repository';
import {
    USER_ACCOUNT_REPOSITORY,
    type UserAccountRepository
} from '../../domain/user-account.repository';
import { UserId } from '../../domain/value-objects/user-id';
import { SsoLoginFailedError } from '../../domain/errors';
import { UserLookupQuery } from '../../infrastructure/queries/user-lookup.query';
import type { IdentityPluginConfig } from '../../types';
import { InjectIdentityConfig } from '../../identity.tokens';
import { ssoCallbackUrl } from '../../sso/sso-settings';

/** What the callback route hands in. */
export interface CompleteSsoInput {
    /** The registered provider name from the route. */
    provider: string;
    /** The opaque token from the request cookie, or null when absent. */
    requestToken: string | null;
    /** What the identity provider returned — query params or form body. */
    params: Readonly<Record<string, string>>;
    /** Client metadata for the session row. */
    context?: SessionContext;
}

/** A completed sign-in: the session to set, and where to land. */
export interface CompletedSsoSignIn {
    /** The session cookie value. */
    session: CreatedSession;
    /** The already-validated same-origin path to redirect to. */
    redirectTo: string;
}

/**
 * Finishes an SSO sign-in: burns the attempt, has the adapter verify the
 * provider's response, resolves the account, and opens a session.
 *
 * **The ordering here is the security design, so it is worth reading as one
 * sequence:**
 *
 * 1. The attempt is found by the browser's cookie. No cookie, no attempt, and
 *    no amount of correct-looking response parameters substitutes for one.
 * 2. `state` is compared **before** anything is exchanged, so a forged callback
 *    costs one indexed lookup rather than a round trip to the provider.
 * 3. The attempt is **burned before the exchange**, not after. Burning
 *    afterwards would let a replayed callback drive a second token exchange
 *    before the first finished; burning first means a replay finds nothing.
 *    The cost is that a network failure during the exchange strands the attempt
 *    and the person clicks the button again — the right trade.
 * 4. The exchange itself runs **outside any transaction**. It is a call to a
 *    third party, and holding a write transaction across one is how a slow
 *    identity provider turns into database contention. Same reasoning as
 *    `ResetPasswordUseCase` keeping bcrypt out of its transaction.
 * 5. Only then does one unit of work resolve the account, create or refresh the
 *    link, open the session and append the event — so a link can never outlive
 *    a sign-in that failed. A link that survived a failed sign-in would grant
 *    the *next* attempt a path that skips the verified-email check entirely.
 *
 * **What it will not do (this phase).** It signs in accounts that already
 * exist. It creates none, and it changes nobody's role. Ortha is invite-only by
 * design, and this replaces the credential check rather than the way in.
 *
 * Every failure raises the same {@link SsoLoginFailedError}. The caller is
 * anonymous and the identity provider is not: told apart, these failures would
 * let anyone who can authenticate at a public provider discover which addresses
 * hold Ortha accounts.
 */
@Injectable()
export class CompleteSsoUseCase {
    private readonly logger = new Logger(CompleteSsoUseCase.name);

    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(SSO_REGISTRY) private readonly registry: SsoRegistry,
        @Inject(SSO_AUTH_REQUEST_REPOSITORY)
        private readonly requests: SsoAuthRequestRepository,
        @Inject(SSO_IDENTITY_REPOSITORY)
        private readonly identities: SsoIdentityRepository,
        @Inject(USER_ACCOUNT_REPOSITORY)
        private readonly accounts: UserAccountRepository,
        @Inject(SESSION_REPOSITORY)
        private readonly sessions: SessionRepository,
        private readonly users: UserLookupQuery,
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    async execute(input: CompleteSsoInput): Promise<CompletedSsoSignIn> {
        const adapter = this.registry.get(input.provider);

        if (!input.requestToken) {
            throw this.fail('the request cookie was missing');
        }
        const attempt = await this.requests.findPendingByToken(
            input.requestToken
        );
        if (!attempt) {
            throw this.fail('no live attempt matches the request cookie');
        }
        if (attempt.provider !== input.provider) {
            throw this.fail(
                'the attempt was started against a different provider'
            );
        }
        if (input.params['state'] !== attempt.state) {
            throw this.fail('the echoed state is not the one we stored');
        }
        if (!(await this.requests.consume(attempt.id))) {
            throw this.fail('the attempt had already been spent');
        }

        const profile = await this.verify(adapter, {
            params: input.params,
            state: attempt.state,
            nonce: attempt.nonce,
            codeVerifier: attempt.codeVerifier,
            redirectUri: ssoCallbackUrl(this.config, input.provider)
        });

        const session = await this.signIn(
            input.provider,
            profile,
            input.context ?? {}
        );
        return { session, redirectTo: attempt.redirectTo };
    }

    /**
     * Runs the adapter's verification and normalises what comes back.
     *
     * `assertSsoProfile` is not distrust of a specific adapter — it is the
     * check the core *can* make. An empty subject would collide with every
     * other empty subject under the same provider, and a subject that is just
     * the email address is the clause-2 mistake in data rather than in prose.
     */
    private async verify(
        adapter: SsoProvider,
        callback: SsoCallback
    ): Promise<SsoProfile> {
        let profile: SsoProfile;
        try {
            profile = await adapter.complete(callback);
        } catch (error) {
            if (error instanceof SsoVerificationError) {
                throw this.fail(error.reason);
            }
            throw error;
        }
        try {
            assertSsoProfile(profile);
        } catch (error) {
            throw this.fail(
                error instanceof Error ? error.message : String(error)
            );
        }
        return normalizeSsoProfile(profile);
    }

    /** Resolves the account, records the link, and opens the session. */
    private signIn(
        provider: string,
        profile: SsoProfile,
        context: SessionContext
    ): Promise<CreatedSession> {
        return this.uow.run(async () => {
            const link = await this.identities.findBySubject(
                provider,
                profile.subject
            );

            const account = link
                ? await this.resolveLinked(link.userId)
                : await this.resolveByVerifiedEmail(provider, profile);

            if (link) {
                await this.identities.recordLogin(
                    link.id,
                    profile.email,
                    new Date()
                );
            }

            const session = await this.sessions.issue(account.userId, context);
            await this.outbox.append(
                attachActor(
                    [
                        identityEvent(
                            IDENTITY_EVENT_KINDS.SIGNED_IN,
                            account.userId,
                            { method: 'sso', provider }
                        )
                    ],
                    { id: account.userId, email: account.email }
                )
            );
            return session;
        });
    }

    /** The account an existing link points at — it must still be usable. */
    private async resolveLinked(
        userId: string
    ): Promise<{ userId: string; email: string }> {
        const account = await this.accounts.findById(UserId.create(userId));
        if (!account) {
            throw this.fail('the linked account no longer exists');
        }
        if (!account.status.isActive) {
            // A `disabled` account with a live link is exactly the case an
            // admin closed the door on. A `pending` one has never accepted its
            // invite, so signing it in here would skip the step that makes an
            // account real.
            throw this.fail(
                `the linked account is ${account.status.value}, not active`
            );
        }
        return { userId, email: account.email.value };
    }

    /**
     * The account a first-time sign-in may claim.
     *
     * Two conditions, and neither is negotiable at this phase: the provider must
     * assert the address is **verified**, and the account must already exist and
     * be `active`. Without the first, any provider that lets a person type an
     * unverified address becomes an account-takeover path into every matching
     * Ortha account. Without the second, this route would quietly become a
     * registration form for a product that has none.
     */
    private async resolveByVerifiedEmail(
        provider: string,
        profile: SsoProfile
    ): Promise<{ userId: string; email: string }> {
        if (!profile.emailVerified) {
            throw this.fail(
                `${provider} did not assert that ${profile.email} is verified`
            );
        }
        const existing = await this.users.credentialsByEmail(profile.email);
        if (!existing) {
            throw this.fail('no account holds that address');
        }
        if (existing.status !== 'active') {
            throw this.fail(`the account is ${existing.status}, not active`);
        }
        await this.identities.link({
            userId: existing.userId,
            provider,
            subject: profile.subject,
            email: profile.email
        });
        return { userId: existing.userId, email: existing.email };
    }

    /** Logs the real reason and returns the one error every caller sees. */
    private fail(reason: string): SsoLoginFailedError {
        this.logger.warn(`SSO sign-in refused: ${reason}`);
        return new SsoLoginFailedError(reason);
    }
}
