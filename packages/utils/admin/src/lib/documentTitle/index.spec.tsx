import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setDocumentTitle, setTitleDecorator, useDocumentTitle } from '.';

// The app name is captured at module load from the host HTML's own <title>;
// jsdom's default document has none, so the module falls back to 'Admin'.
const APP_NAME = 'Admin';

function Page({ title }: { title: string }) {
    useDocumentTitle(title);
    return null;
}

afterEach(() => {
    setTitleDecorator(null);
    setDocumentTitle(null);
});

describe('setDocumentTitle', () => {
    it('composes the page title with the app name', () => {
        setDocumentTitle('Members');
        expect(document.title).toBe(`Members · ${APP_NAME}`);
    });

    it('falls back to the bare app name for null', () => {
        setDocumentTitle('Members');
        setDocumentTitle(null);
        expect(document.title).toBe(APP_NAME);
    });
});

describe('setTitleDecorator', () => {
    it('wraps the composed title without becoming the title', () => {
        setDocumentTitle('Members');
        setTitleDecorator((title) => `(3) ${title}`);
        expect(document.title).toBe(`(3) Members · ${APP_NAME}`);
    });

    it('does not compound when the page title changes underneath it', () => {
        setTitleDecorator((title) => `(3) ${title}`);
        setDocumentTitle('Members');
        setDocumentTitle('Activity');
        expect(document.title).toBe(`(3) Activity · ${APP_NAME}`);
    });

    it('is removed by passing null, restoring the composed title', () => {
        setDocumentTitle('Members');
        setTitleDecorator((title) => `(3) ${title}`);
        setTitleDecorator(null);
        expect(document.title).toBe(`Members · ${APP_NAME}`);
    });
});

describe('useDocumentTitle', () => {
    it('sets the title while mounted and restores the app name on unmount', () => {
        const { unmount } = render(<Page title="Members" />);
        expect(document.title).toBe(`Members · ${APP_NAME}`);

        unmount();
        expect(document.title).toBe(APP_NAME);
    });

    it('follows a changing title', () => {
        const { rerender } = render(<Page title="Members" />);
        rerender(<Page title="Activity" />);
        expect(document.title).toBe(`Activity · ${APP_NAME}`);
    });
});
