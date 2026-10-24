import { Injectable } from '@nestjs/common';
import type { PasswordRecoveryIssuer } from './ports/password-recovery.port';

/**
 * Where the plugin that can issue a self-service reset registers itself — see
 * {@link PasswordRecoveryIssuer} for why this is a registry rather than a DI
 * token. Exported by the (global) identity module, so the users plugin injects
 * it from its own injector and calls {@link register} in `onModuleInit`.
 *
 * Holds one issuer. A second registration is a wiring bug — two plugins each
 * believing they own the reset token — so it throws rather than letting one of
 * them win silently.
 */
@Injectable()
export class PasswordRecoveryRegistry {
    private issuer: PasswordRecoveryIssuer | null = null;

    /** Registers the issuer. Throws on a second registration. */
    register(issuer: PasswordRecoveryIssuer): void {
        if (this.issuer && this.issuer !== issuer) {
            throw new Error(
                'A password recovery issuer is already registered — exactly one plugin issues self-service resets.'
            );
        }
        this.issuer = issuer;
    }

    /** The registered issuer, or `null` when no plugin offers recovery. */
    current(): PasswordRecoveryIssuer | null {
        return this.issuer;
    }
}
