import { parseBlocks } from './parseBlocks';

describe('parseBlocks', () => {
    it('parses a pipe table into a table block', () => {
        const blocks = parseBlocks(
            [
                '| API Name | Label | Kind |',
                '|----------|-------|------|',
                '| author | Authors | Collection |',
                '| home_page | Home page | Single |'
            ].join('\n')
        );

        expect(blocks).toEqual([
            {
                kind: 'table',
                header: ['API Name', 'Label', 'Kind'],
                align: ['left', 'left', 'left'],
                rows: [
                    ['author', 'Authors', 'Collection'],
                    ['home_page', 'Home page', 'Single']
                ]
            }
        ]);
    });

    // The exact regression: without table support the rows fell through to the
    // paragraph branch, which joins lines with a space — producing one
    // unreadable run-on line.
    it('does not collapse a table into a paragraph', () => {
        const blocks = parseBlocks('| a | b |\n|---|---|\n| 1 | 2 |');

        expect(blocks.map((block) => block.kind)).toEqual(['table']);
    });

    it('reads column alignment from the separator', () => {
        const blocks = parseBlocks(
            '| a | b | c |\n|:---|:--:|---:|\n| 1 | 2 | 3 |'
        );

        expect(blocks[0]).toMatchObject({
            align: ['left', 'center', 'right']
        });
    });

    it('accepts a table without leading and trailing pipes', () => {
        const blocks = parseBlocks('a | b\n--- | ---\n1 | 2');

        expect(blocks[0]).toMatchObject({
            header: ['a', 'b'],
            rows: [['1', '2']]
        });
    });

    // A row that is still streaming in, or that the model got wrong, must not
    // shift every cell after it.
    it('pads a short row and trims a long one to the header width', () => {
        const blocks = parseBlocks(
            '| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |'
        );

        expect(blocks[0]).toMatchObject({
            rows: [
                ['1', ''],
                ['1', '2']
            ]
        });
    });

    it('keeps a pipe line with no separator as a paragraph', () => {
        const blocks = parseBlocks('this | that');

        expect(blocks).toEqual([{ kind: 'paragraph', text: 'this | that' }]);
    });

    it('parses text before and after a table', () => {
        const blocks = parseBlocks(
            'Here they are:\n\n| a |\n|---|\n| 1 |\n\nThat is all.'
        );

        expect(blocks.map((block) => block.kind)).toEqual([
            'paragraph',
            'table',
            'paragraph'
        ]);
    });

    it('still parses the other block kinds', () => {
        const blocks = parseBlocks(
            '# Title\n\ntext\n\n- one\n- two\n\n```ts\ncode\n```'
        );

        expect(blocks.map((block) => block.kind)).toEqual([
            'heading',
            'paragraph',
            'list',
            'code'
        ]);
    });

    it('renders a partially streamed table rather than waiting', () => {
        // Only the header and separator have arrived so far.
        const blocks = parseBlocks('| a | b |\n|---|---|');

        expect(blocks[0]).toMatchObject({ kind: 'table', rows: [] });
    });
});
