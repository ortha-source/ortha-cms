import {
    htmlExcerpt,
    htmlTextLength,
    htmlToPlainText,
    isEmptyHtml
} from './plain-text';

describe('htmlToPlainText', () => {
    it('drops markup and separates blocks with a newline', () => {
        expect(htmlToPlainText('<h2>Title</h2><p>Body <b>bold</b></p>')).toBe(
            'Title\nBody bold'
        );
    });

    it('decodes the entities a reader would see', () => {
        expect(htmlToPlainText('<p>Tom&nbsp;&amp;&nbsp;Jerry</p>')).toBe(
            'Tom & Jerry'
        );
    });

    it('turns a line break into one', () => {
        expect(htmlToPlainText('<p>a<br>b</p>')).toBe('a\nb');
    });

    it('ignores script and style content', () => {
        expect(htmlToPlainText('<p>hi</p><style>p{color:red}</style>')).toBe(
            'hi'
        );
    });
});

describe('htmlTextLength', () => {
    it('counts what the author typed, not the markup around it', () => {
        expect(htmlTextLength('<p><strong>12345</strong></p>')).toBe(5);
    });
});

describe('htmlExcerpt', () => {
    it('returns short content untouched', () => {
        expect(htmlExcerpt('<p>short</p>')).toBe('short');
    });

    it('truncates on a word boundary with an ellipsis', () => {
        const excerpt = htmlExcerpt(`<p>${'word '.repeat(40)}</p>`, 20);
        expect(excerpt.endsWith('…')).toBe(true);
        expect(excerpt.length).toBeLessThanOrEqual(21);
    });
});

describe('isEmptyHtml', () => {
    it.each(['', '   ', '<p></p>', '<p><br></p>', null, undefined])(
        'treats %p as empty',
        (html) => {
            expect(isEmptyHtml(html)).toBe(true);
        }
    );

    it('treats a divider or an image as content', () => {
        expect(isEmptyHtml('<hr>')).toBe(false);
        expect(isEmptyHtml('<figure><img src="a.png"></figure>')).toBe(false);
    });
});
