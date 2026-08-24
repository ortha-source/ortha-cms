// --- the SSO seam ---
//
// The identity-provider port and everything the core needs to hold it to its
// contract. Framework-free by rule (ADR-0013 §1): nothing here imports
// `@nestjs/*`, `drizzle-orm`, or a protocol library, so an adapter package can
// depend on the port without inheriting the server's dependency graph.
export type {
    SsoProvider,
    SsoProviderDescriptor,
    SsoProviderKind,
    SsoProviderSummary,
    SsoAuthorizeRequest,
    SsoAuthorizeRedirect,
    SsoCallback,
    SsoLogoutRequest,
    SsoRegistration,
    SsoRegistry
} from './lib/sso/sso-provider';
export { SSO_REGISTRY } from './lib/sso/sso-provider';
// Group-to-role mapping. A host-supplied handler, like the copilot's
// `ModelResolver` and media's `resolve` — plain code at the composition root,
// because "which of our groups means editor?" is a deployment's own question
// and no configuration shape has ever answered it for everyone.
export { SSO_ROLE_RESOLVER } from './lib/sso/sso-role-resolver';
export type {
    SsoRoleResolver,
    SsoRoleContext
} from './lib/sso/sso-role-resolver';
export type { SsoProfile } from './lib/sso/sso-profile';
export {
    assertSsoProfile,
    normalizeSsoProfile,
    MalformedSsoProfileError
} from './lib/sso/sso-profile';
export {
    SsoVerificationError,
    UnknownSsoProviderError
} from './lib/sso/errors';
// The open-redirect guard. Pure, and here rather than in the controller that
// calls it, because it is the single most commonly botched rule in this
// feature and it deserves its own tests without a server around it.
export { safeRedirectPath } from './lib/sso/redirect-target';
// The port's conformance kit. Framework-free on purpose: it reports rather than
// asserts, so it needs no test runner and this package still imports nothing.
export {
    SSO_PROVIDER_CONFORMANCE_CHECKS,
    runSsoProviderConformance
} from './lib/sso/conformance';
export type {
    SsoAuthorizeScenario,
    SsoCallbackScenario,
    SsoProviderConformanceCase,
    SsoProviderConformanceCheck,
    SsoProviderConformanceReport
} from './lib/sso/conformance';
