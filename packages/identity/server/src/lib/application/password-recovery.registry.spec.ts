import { PasswordRecoveryRegistry } from './password-recovery.registry';
import type { PasswordRecoveryIssuer } from './ports/password-recovery.port';

function issuer(available = true): PasswordRecoveryIssuer {
    return { available, issue: async () => undefined };
}

describe('PasswordRecoveryRegistry', () => {
    it('holds nothing until a plugin registers', () => {
        expect(new PasswordRecoveryRegistry().current()).toBeNull();
    });

    it('hands back the registered issuer', () => {
        const registry = new PasswordRecoveryRegistry();
        const registered = issuer();
        registry.register(registered);
        expect(registry.current()).toBe(registered);
    });

    it('tolerates the same issuer registering twice', () => {
        const registry = new PasswordRecoveryRegistry();
        const registered = issuer();
        registry.register(registered);
        expect(() => registry.register(registered)).not.toThrow();
    });

    it('refuses a second, different issuer — a wiring bug, not a tie to break', () => {
        const registry = new PasswordRecoveryRegistry();
        registry.register(issuer());
        expect(() => registry.register(issuer())).toThrow(/already registered/);
    });
});
