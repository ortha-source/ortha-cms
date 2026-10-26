import { describe, expect, it } from 'vitest';
import { describeUserAgent } from '.';

describe('describeUserAgent', () => {
    it.each([
        [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            { browser: 'Safari', os: 'macOS', mobile: false }
        ],
        [
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
            { browser: 'Chrome', os: 'Android', mobile: true }
        ],
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
            { browser: 'Edge', os: 'Windows', mobile: false }
        ],
        [
            'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
            { browser: 'Firefox', os: 'Linux', mobile: false }
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
            { browser: 'Chrome', os: 'iOS', mobile: true }
        ]
    ])('reads %s', (ua, expected) => {
        expect(describeUserAgent(ua)).toEqual(expected);
    });

    it('admits what it does not recognise instead of guessing', () => {
        expect(describeUserAgent('curl/8.4.0')).toEqual({
            browser: null,
            os: null,
            mobile: false
        });
        expect(describeUserAgent(null)).toEqual({
            browser: null,
            os: null,
            mobile: false
        });
    });
});
