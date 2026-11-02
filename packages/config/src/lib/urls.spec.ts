import { allowedOrigins, publicUrl } from './urls';

describe('PUBLIC_URL and the origins derived from it', () => {
    const saved = process.env;
    afterEach(() => {
        process.env = saved;
    });

    it('defaults to the admin dev server outside production', () => {
        process.env = { ADMIN_PORT: '4300' };
        expect(publicUrl()).toBe('http://localhost:4300');
    });

    it('has no default in production', () => {
        process.env = { NODE_ENV: 'production' };
        expect(publicUrl()).toBeUndefined();
        expect(() => allowedOrigins()).toThrow(
            'Missing required environment variable PUBLIC_URL'
        );
    });

    it('drops a trailing slash and keeps a path', () => {
        process.env = { PUBLIC_URL: 'https://example.com/cms/' };
        expect(publicUrl()).toBe('https://example.com/cms');
    });

    it('allows only the origin, not the path', () => {
        process.env = {
            NODE_ENV: 'production',
            PUBLIC_URL: 'https://example.com/cms'
        };
        expect(allowedOrigins()).toEqual(['https://example.com']);
    });

    it('refuses a scheme other than http and https', () => {
        process.env = { PUBLIC_URL: 'ftp://example.com' };
        expect(() => publicUrl()).toThrow(
            'must start with http:// or https://'
        );
    });
});
