/**
 * Which URLs this server is willing to POST to.
 *
 * A webhook is, precisely, "the server makes a request to an address a user
 * typed". That is the shape of every SSRF, so the policy is a first-class part
 * of the domain rather than a check bolted onto the HTTP client: the same
 * function guards the create/update form (so a bad URL is refused in the
 * dialog) and the delivery worker (so a URL that became bad afterwards — a
 * hostname re-pointed at `127.0.0.1` — is refused on the way out).
 *
 * Everything here is pure. The DNS lookup lives in the server package; this
 * file decides what to make of the address it resolved.
 */

/** What a deployment is willing to allow beyond the safe default. */
export interface WebhookUrlPolicy {
    /**
     * Permit `http://` as well as `https://`. Off by default — a signature over
     * plaintext still leaks the payload to anyone on the path.
     */
    allowInsecureUrls: boolean;
    /**
     * Permit loopback, link-local and RFC 1918 destinations. Off by default;
     * a self-hosted install whose receiver sits in the same cluster turns it on
     * deliberately, and thereby accepts that an operator can point a webhook at
     * an internal service.
     */
    allowPrivateNetworks: boolean;
}

/** The safe default — public HTTPS destinations only. */
export const DEFAULT_URL_POLICY: WebhookUrlPolicy = {
    allowInsecureUrls: false,
    allowPrivateNetworks: false
};

/** Why a URL was refused. */
export class WebhookUrlRejectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WebhookUrlRejectedError';
    }
}

/**
 * Checks the parts of a URL that need no network: scheme, embedded
 * credentials, and a literal IP host.
 *
 * Returns the parsed URL so the caller does not parse it twice. Throws
 * {@link WebhookUrlRejectedError} with a message meant for the person who typed
 * the URL — it is shown in the dialog.
 */
export function assertUrlShape(
    raw: string,
    policy: WebhookUrlPolicy = DEFAULT_URL_POLICY
): URL {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new WebhookUrlRejectedError(
            'That is not a valid URL. Include the scheme, e.g. https://example.com/hooks.'
        );
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new WebhookUrlRejectedError(
            `Webhooks are delivered over HTTP(S); ${url.protocol} is not supported.`
        );
    }

    if (url.protocol === 'http:' && !policy.allowInsecureUrls) {
        throw new WebhookUrlRejectedError(
            'Use https://. Plain HTTP exposes the payload to anyone on the network path.'
        );
    }

    if (url.username || url.password) {
        // Credentials in the URL would be sent on every retry and shown in the
        // delivery log; the signature is how a receiver authenticates us.
        throw new WebhookUrlRejectedError(
            'Remove the username and password from the URL. Deliveries are authenticated by their signature.'
        );
    }

    const host = hostname(url);
    if (host.length === 0) {
        throw new WebhookUrlRejectedError('The URL is missing a host name.');
    }

    // A literal IP can be judged immediately; a name needs the resolver.
    if (
        isIpLiteral(host) &&
        !policy.allowPrivateNetworks &&
        isPrivateAddress(host)
    ) {
        throw new WebhookUrlRejectedError(
            `${host} is a private or reserved address. Webhooks may only reach public hosts.`
        );
    }

    return url;
}

/**
 * Checks a resolved address against the policy — the second half of the guard,
 * run once the hostname has been looked up.
 *
 * The decision has to be made on the **address**, not the name: a hostname that
 * resolves to `169.254.169.254` today looked perfectly ordinary when it was
 * saved, and a name checked at save time and connected to later is the textbook
 * DNS-rebinding hole.
 */
export function assertAddressAllowed(
    address: string,
    policy: WebhookUrlPolicy = DEFAULT_URL_POLICY
): void {
    if (policy.allowPrivateNetworks) return;
    if (isPrivateAddress(address)) {
        throw new WebhookUrlRejectedError(
            `The host resolves to ${address}, a private or reserved address. Webhooks may only reach public hosts.`
        );
    }
}

/** The host without IPv6 brackets. */
export function hostname(url: URL): string {
    return url.hostname.replace(/^\[|\]$/g, '');
}

/** Whether `host` is an IP literal rather than a name needing resolution. */
export function isIpLiteral(host: string): boolean {
    return parseIpv4(host) !== null || host.includes(':');
}

/**
 * Whether an IPv4 or IPv6 address is one this server must not be talked into
 * reaching: loopback, the cloud metadata range, private and reserved space.
 */
export function isPrivateAddress(address: string): boolean {
    const v4 = parseIpv4(address);
    if (v4) return isPrivateIpv4(v4);

    const normalized = address.toLowerCase().replace(/%.*$/, '');

    // An IPv4-mapped or IPv4-compatible address is an IPv4 destination wearing
    // a different notation; judging it as "some IPv6 address" would wave
    // ::ffff:127.0.0.1 straight through.
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
        const inner = parseIpv4(mapped[1]);
        return inner ? isPrivateIpv4(inner) : true;
    }

    if (normalized === '::' || normalized === '::1') return true;
    // Unique-local fc00::/7, link-local fe80::/10, multicast ff00::/8.
    if (/^f[cd][0-9a-f]{0,2}:/.test(normalized)) return true;
    if (/^fe[89ab][0-9a-f]?:/.test(normalized)) return true;
    if (/^ff[0-9a-f]{0,2}:/.test(normalized)) return true;

    return false;
}

/** `a.b.c.d` as four octets, or `null` when it is not a dotted-quad. */
function parseIpv4(value: string): [number, number, number, number] | null {
    const parts = value.split('.');
    if (parts.length !== 4) return null;

    const octets: number[] = [];
    for (const part of parts) {
        // Reject '01' and '0x7f' style notations rather than trying to honour
        // them: they are how a blocklist gets walked around.
        if (!/^\d{1,3}$/.test(part)) return null;
        const octet = Number(part);
        if (octet > 255) return null;
        if (part.length > 1 && part.startsWith('0')) return null;
        octets.push(octet);
    }

    return octets as [number, number, number, number];
}

/** The reserved IPv4 space, as CIDR prefixes. */
const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
    ['0.0.0.0', 8], // "this network"
    ['10.0.0.0', 8], // RFC 1918
    ['100.64.0.0', 10], // CGNAT
    ['127.0.0.0', 8], // loopback
    ['169.254.0.0', 16], // link-local — includes cloud metadata at .169.254
    ['172.16.0.0', 12], // RFC 1918
    ['192.0.0.0', 24], // IETF protocol assignments
    ['192.0.2.0', 24], // TEST-NET-1
    ['192.88.99.0', 24], // 6to4 relay anycast
    ['192.168.0.0', 16], // RFC 1918
    ['198.18.0.0', 15], // benchmarking
    ['198.51.100.0', 24], // TEST-NET-2
    ['203.0.113.0', 24], // TEST-NET-3
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4] // reserved, includes 255.255.255.255
];

/** Whether an IPv4 address falls in any reserved range. */
function isPrivateIpv4(octets: [number, number, number, number]): boolean {
    const value = toUint32(octets);
    return PRIVATE_IPV4_RANGES.some(([prefix, bits]) => {
        const base = parseIpv4(prefix);
        if (!base) return false;
        // A /0 mask would shift by 32, which is a no-op in JS — no range here
        // uses one, and the guard keeps it that way if one is ever added.
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        return (value & mask) >>> 0 === (toUint32(base) & mask) >>> 0;
    });
}

/** Four octets as an unsigned 32-bit integer. */
function toUint32(octets: [number, number, number, number]): number {
    return (
        ((octets[0] << 24) |
            (octets[1] << 16) |
            (octets[2] << 8) |
            octets[3]) >>>
        0
    );
}
