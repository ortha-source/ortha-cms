import { mailFromEnv, parseMailUrl } from './mail';

describe('MAIL_URL', () => {
    const saved = process.env;
    beforeEach(() => {
        process.env = {
            MAIL_FROM: 'CMS <cms@example.com>',
            PUBLIC_URL: 'https://cms.example.com'
        };
    });
    afterEach(() => {
        process.env = saved;
    });

    it('reads a relay, its credentials and STARTTLS from smtp://', () => {
        expect(
            parseMailUrl('smtp://apikey:s%40cret@smtp.example.com:587')
        ).toEqual({
            backend: 'smtp',
            smtp: {
                host: 'smtp.example.com',
                port: 587,
                user: 'apikey',
                password: 's@cret'
            }
        });
    });

    it('reads smtps:// as implicit TLS', () => {
        expect(parseMailUrl('smtps://smtp.example.com:465').smtp).toEqual({
            host: 'smtp.example.com',
            port: 465,
            secure: true
        });
    });

    it('reads requireTls, and refuses an option it does not know', () => {
        expect(
            parseMailUrl('smtp://smtp.example.com?requireTls=true').smtp
                ?.requireTls
        ).toBe(true);
        expect(() => parseMailUrl('smtp://smtp.example.com?tls=on')).toThrow(
            'an option this server does not know: tls'
        );
    });

    it('refuses a scheme it cannot send through', () => {
        expect(() => parseMailUrl('ses://eu-west-1')).toThrow(
            'MAIL_URL must start with smtp://, smtps:// or console://'
        );
    });

    it('sends nothing when unset — a complete configuration', () => {
        expect(mailFromEnv(['smtp'])).toBeUndefined();
    });

    it('builds every link from PUBLIC_URL and requires a sender', () => {
        process.env['MAIL_URL'] = 'smtp://smtp.example.com';
        expect(mailFromEnv(['smtp'])).toMatchObject({
            backend: 'smtp',
            appUrl: 'https://cms.example.com',
            from: 'CMS <cms@example.com>',
            revealLinks: false
        });
        delete process.env['MAIL_FROM'];
        expect(() => mailFromEnv(['smtp'])).toThrow('MAIL_FROM');
    });

    it('refuses a backend the app has not installed', () => {
        // console:// in a generated app, which ships only SMTP: mail that
        // looks configured and reaches nobody.
        process.env['MAIL_URL'] = 'console://';
        expect(() => mailFromEnv(['smtp'])).toThrow(
            'which this app does not have installed'
        );
    });

    it('still reads MAIL_PROVIDER and SMTP_*, with a warning', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        Object.assign(process.env, {
            MAIL_PROVIDER: 'smtp',
            SMTP_HOST: 'relay.example.com',
            SMTP_PORT: '2525'
        });
        expect(mailFromEnv(['smtp'])?.smtp).toEqual({
            host: 'relay.example.com',
            port: 2525
        });
        warn.mockRestore();
    });

    it('queues without sending when ORTHACMS_WORKERS=false', () => {
        process.env['MAIL_URL'] = 'console://';
        process.env['ORTHACMS_WORKERS'] = 'false';
        expect(mailFromEnv(['console'])?.deliveryIntervalMs).toBe(0);
    });
});
