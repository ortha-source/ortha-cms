import { InsightsPlugin, DEFAULT_INSIGHTS_SECTIONS } from './index';
import {
    INSIGHTS_SECTION_SLOT,
    INSIGHTS_WIDGET_SLOT
} from '../../presentation/slots/insightsSlots';

/**
 * The "frame only" rule, stated where it can actually be broken.
 *
 * A plugin's slot contributions are the one way anything reaches the Insights
 * page, so the factory's own list is the whole surface: if this package ever
 * grows a widget of its own it has to be written here, and that is the moment
 * the dashboard starts having to know what another package's data looks like.
 */
describe('InsightsPlugin', () => {
    it('contributes no widget of its own [insights:I-02]', () => {
        const plugin = InsightsPlugin();

        expect(
            plugin.slots?.filter(
                (contribution) => contribution.slot === INSIGHTS_WIDGET_SLOT
            )
        ).toEqual([]);
    });

    it('registers its bands through the ordinary section slot [insights:I-02]', () => {
        const plugin = InsightsPlugin();
        const sections = plugin.slots?.filter(
            (contribution) => contribution.slot === INSIGHTS_SECTION_SLOT
        );

        // There is no privileged set of bands: the four built-ins arrive the
        // same way anybody else's do, which is what makes overriding one and
        // opening a new one the same act.
        expect(sections).toHaveLength(1);
        expect(sections?.[0].items).toEqual(DEFAULT_INSIGHTS_SECTIONS);
    });

    it('lets a host replace the built-in bands wholesale [insights:I-02]', () => {
        const plugin = InsightsPlugin({ sections: [] });

        expect(
            plugin.slots?.find(
                (contribution) => contribution.slot === INSIGHTS_SECTION_SLOT
            )?.items
        ).toEqual([]);
        expect(
            plugin.slots?.some(
                (contribution) => contribution.slot === INSIGHTS_WIDGET_SLOT
            )
        ).toBe(false);
    });
});
