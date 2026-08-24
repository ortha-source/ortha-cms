/** One person the scripted identity provider knows about. */
export interface FakeSsoUser {
    /**
     * The provider's stable identifier for them. Anything but their email —
     * the port's second clause, and the conformance kit checks it.
     */
    subject: string;
    /** The address the provider reports. */
    email: string;
    /**
     * Whether the provider claims to have verified {@link email}. Defaults to
     * `true`, because a suite that wants the unverified path says so
     * explicitly, and one that does not should get the ordinary case.
     */
    emailVerified?: boolean;
    /** Display name, when the scenario needs one. */
    name?: string;
    /** Group claims, for the role-mapping paths. */
    groups?: readonly string[];
}

/** How a scripted provider is built. */
export interface FakeSsoProviderConfig {
    /**
     * Who this provider can sign in. The first entry answers until a caller
     * says otherwise with `signInAs`.
     */
    users: readonly FakeSsoUser[];
    /** Button text. Defaults to `Fake IdP`. */
    label?: string;
    /**
     * The value the scripted authorization response is signed with.
     *
     * A fake with a real signature check is the point: "tampering is rejected"
     * has to be a property of the adapter, not a claim in a comment, or the
     * conformance kit is checking nothing on the one adapter that runs in every
     * CI job. Defaults to a constant — there is no secret to protect here.
     */
    secret?: string;
}
