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
    if (!address.includes(':')) return false;

    const groups = parseIpv6(address.replace(/%.*$/, ''));
    // Anything with a colon that is not a well-formed IPv6 address cannot be
    // vouched for. Neither the URL parser nor the resolver produces one, so
    // refusing it costs nothing.
    if (!groups) return true;

    // An IPv4 destination wearing IPv6 notation is judged as that IPv4
    // address; judging it as "some IPv6 address" would wave ::ffff:127.0.0.1
    // straight through — and the URL parser hands it over as ::ffff:7f00:1.
    const embedded = embeddedIpv4(groups);
    if (embedded) return isPrivateIpv4(embedded);

    const [first] = groups;
    // Unique-local fc00::/7, link-local fe80::/10, multicast ff00::/8.
    if ((first & 0xfe00) === 0xfc00) return true;
    if ((first & 0xffc0) === 0xfe80) return true;
    if ((first & 0xff00) === 0xff00) return true;
    // Local-use NAT64 64:ff9b:1::/48 (RFC 8215) only ever translates into a
    // network the operator chose, so there is nothing public behind it.
    if (first === 0x64 && groups[1] === 0xff9b && groups[2] === 1) return true;

    return false;
}

/**
 * The IPv4 address an IPv6 one carries, for the notations that route to it:
 * IPv4-mapped `::ffff:0:0/96`, IPv4-translated `::ffff:0:0:0/96`,
 * IPv4-compatible `::/96` (which also covers `::` and `::1` — both land in
 * `0.0.0.0/8`), NAT64 `64:ff9b::/96`, and 6to4 `2002::/16`.
 */
function embeddedIpv4(
    groups: readonly number[]
): [number, number, number, number] | null {
    const zero = (from: number, to: number): boolean =>
        groups.slice(from, to).every((group) => group === 0);
    const octets = (
        hi: number,
        lo: number
    ): [number, number, number, number] => [
        hi >> 8,
        hi & 0xff,
        lo >> 8,
        lo & 0xff
    ];

    if (zero(0, 5) && groups[5] === 0xffff) return octets(groups[6], groups[7]);
    if (zero(0, 4) && groups[4] === 0xffff && groups[5] === 0) {
        return octets(groups[6], groups[7]);
    }
    if (zero(0, 6)) return octets(groups[6], groups[7]);
    if (groups[0] === 0x64 && groups[1] === 0xff9b && zero(2, 6)) {
        return octets(groups[6], groups[7]);
    }
    if (groups[0] === 0x2002) return octets(groups[1], groups[2]);
    return null;
}

/**
 * An IPv6 address as eight 16-bit groups, or `null` when it is not one.
 * Accepts `::` compression in any position and a trailing dotted-quad
 * (`::ffff:127.0.0.1`), in either case.
 */
function parseIpv6(value: string): number[] | null {
    let text = value.toLowerCase();

    // A trailing dotted-quad stands for the last two groups; rewrite it as
    // them so the rest of the parse only ever sees hex.
    const lastColon = text.lastIndexOf(':');
    if (lastColon !== -1 && text.includes('.', lastColon)) {
        const quad = parseIpv4(text.slice(lastColon + 1));
        if (!quad) return null;
        const hi = ((quad[0] << 8) | quad[1]).toString(16);
        const lo = ((quad[2] << 8) | quad[3]).toString(16);
        text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
    }

    const halves = text.split('::');
    if (halves.length > 2) return null;

    const head = parseGroups(halves[0]);
    const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
    if (!head || !tail) return null;

    if (halves.length === 1) return head.length === 8 ? head : null;
    // `::` stands for at least one zero group.
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

/** Colon-separated hex groups (`''` is none), or `null` on any bad group. */
function parseGroups(text: string): number[] | null {
    if (text === '') return [];
    const groups: number[] = [];
    for (const part of text.split(':')) {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        groups.push(parseInt(part, 16));
    }
    return groups;
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
