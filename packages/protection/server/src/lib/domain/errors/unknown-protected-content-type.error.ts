/**
 * The named `(kind, slug)` pair is not a content type this workspace can
 * protect.
 *
 * **Three different causes, one error, deliberately.** The type may not be
 * registered at all, it may be registered under the other kind, or it may
 * simply not be granted to this workspace. Distinguishing them would let a
 * member of one workspace enumerate the deployment's whole content model
 * through the protection settings tab — content's own `resolveGrantedType`
 * makes the same choice for the same reason.
 */
export class UnknownProtectedContentTypeError extends Error {
    constructor(
        readonly kind: string,
        readonly slug: string
    ) {
        super(`Unknown content type "${kind}/${slug}" for this workspace.`);
        this.name = 'UnknownProtectedContentTypeError';
    }
}
