/**
 * A session's `User-Agent`, reduced to what a person recognises: "Safari on
 * macOS", "Chrome on Android". Pure, and deliberately coarse — the full string
 * stays one hover away (the caller keeps it as a `title`), and a browser this
 * table does not know is reported as `null` rather than guessed.
 */
export type DeviceDescription = {
    /** The browser's everyday name, or `null` when unrecognised. */
    browser: string | null;
    /** The operating system's everyday name, or `null` when unrecognised. */
    os: string | null;
    /** Whether the device is a phone or tablet (for the row's icon). */
    mobile: boolean;
};

/** Ordered: the first match wins, so the more specific tokens come first. */
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
    [/\bEdg(e|A|iOS)?\//, 'Edge'],
    [/\bOPR\/|\bOpera\b/, 'Opera'],
    [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
    [/\bCriOS\/|\bChrome\//, 'Chrome'],
    [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari']
];

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
    [/\biPhone\b|\biPad\b|\biPod\b/, 'iOS'],
    [/\bAndroid\b/, 'Android'],
    [/\bCrOS\b/, 'ChromeOS'],
    [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
    [/\bWindows\b/, 'Windows'],
    [/\bLinux\b/, 'Linux']
];

/** Reads a browser and an operating system out of a `User-Agent`. */
export function describeUserAgent(
    userAgent: string | null | undefined
): DeviceDescription {
    const ua = userAgent?.trim() ?? '';
    const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
    const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
    return {
        browser,
        os,
        mobile: /\bMobile\b|\bAndroid\b|\biPhone\b|\biPad\b/.test(ua)
    };
}
