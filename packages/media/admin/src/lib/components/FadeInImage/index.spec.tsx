import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FadeInImage } from './index';

/**
 * jsdom never fetches an image, so `complete` stays false and neither `load`
 * nor `error` fires on its own — which is exactly the browser state the fade
 * starts from. These pin the two ways out of it that a browser test cannot
 * stage on demand: an image that was already in the cache before React could
 * listen, and one that will never load at all.
 */
describe('FadeInImage', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts hidden and fades in once the image loads', () => {
        render(<FadeInImage src="/a.webp" alt="Hero" />);
        const image = screen.getByRole('img', { name: 'Hero' });

        expect(image.classList.contains('opacity-0')).toBe(true);
        expect(image.classList.contains('motion-reduce:transition-none')).toBe(
            true
        );

        fireEvent.load(image);
        expect(image.classList.contains('opacity-100')).toBe(true);
        expect(image.classList.contains('opacity-0')).toBe(false);
    });

    it('shows a cached image on the first paint, with no load event', () => {
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
            true
        );

        render(<FadeInImage src="/cached.webp" alt="Cached" />);

        expect(
            screen
                .getByRole('img', { name: 'Cached' })
                .classList.contains('opacity-100')
        ).toBe(true);
    });

    it('reveals a broken image instead of leaving the tile blank', () => {
        const onError = vi.fn();
        render(
            <FadeInImage src="/missing.webp" alt="Gone" onError={onError} />
        );
        const image = screen.getByRole('img', { name: 'Gone' });

        fireEvent.error(image);

        expect(image.classList.contains('opacity-100')).toBe(true);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('hides again when the same element is pointed at a new image', () => {
        const { rerender } = render(<FadeInImage src="/one.webp" alt="Tile" />);
        const image = screen.getByRole('img', { name: 'Tile' });
        fireEvent.load(image);
        expect(image.classList.contains('opacity-100')).toBe(true);

        rerender(<FadeInImage src="/two.webp" alt="Tile" />);
        expect(image.classList.contains('opacity-0')).toBe(true);
    });
});
