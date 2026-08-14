import { useEffect } from 'react';

/**
 * The app name, taken from the host HTML's own `<title>` (`apps/admin/index.html`)
 * rather than hardcoded here — this leaf shouldn't own the product's name.
 * Captured once at module load, before anything can decorate it.
 */
const APP_NAME =
    typeof document === 'undefined' ? '' : document.title.trim() || 'Admin';

/** The current page's title, or `null` on a route that hasn't set one. */
let page: string | null = null;

/** Wraps the composed title — how the copilot's unread badge is applied. */
let decorate: (title: string) => string = (title) => title;

const compose = () => (page ? `${page} · ${APP_NAME}` : APP_NAME);

const render = () => {
    if (typeof document === 'undefined') return;
    document.title = decorate(compose());
};

/**
 * Sets the current page's title, composed as `{page} · {app}`. Pass `null` to
 * fall back to the app name alone.
 */
export function setDocumentTitle(next: string | null): void {
    page = next;
    render();
}

/**
 * Installs (or clears, with `null`) a decorator applied over the composed title
 * — e.g. the copilot's `(3) ` unread prefix.
 *
 * Decoration is a *transform*, not a write, so a page-title change and a badge
 * change can't clobber each other: whoever moves last re-renders from the same
 * composed base rather than from whatever happened to be in `document.title`.
 */
export function setTitleDecorator(
    next: ((title: string) => string) | null
): void {
    decorate = next ?? ((title) => title);
    render();
}

/**
 * Sets the document title for as long as the calling route is mounted, and
 * restores the bare app name on unmount.
 *
 * The tab title is the primary orientation cue when switching windows or tabs,
 * and it labels history entries and bookmarks — a single static title makes
 * every route in the product indistinguishable (WCAG 2.4.2 Page Titled).
 */
export function useDocumentTitle(title: string): void {
    useEffect(() => {
        setDocumentTitle(title);
        return () => setDocumentTitle(null);
    }, [title]);
}
