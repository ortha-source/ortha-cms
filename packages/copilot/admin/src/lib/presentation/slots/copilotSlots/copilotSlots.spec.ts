import {
    COPILOT_TOOL_RESULT_SLOT,
    toolResultRendererFor,
    type CopilotToolResultItem
} from './index';

/** A contribution — the component is never mounted here, only resolved. */
const item = (id: string, toolName: string): CopilotToolResultItem =>
    ({
        id,
        toolName,
        Component: () => null
    }) as CopilotToolResultItem;

describe('COPILOT_TOOL_RESULT_SLOT', () => {
    beforeEach(() => {
        COPILOT_TOOL_RESULT_SLOT._reset();
    });

    it('resolves a contribution by exact tool name', () => {
        COPILOT_TOOL_RESULT_SLOT._register([
            item('alarms', 'admin_alarms_findings')
        ]);
        expect(toolResultRendererFor('admin_alarms_findings')?.id).toBe(
            'alarms'
        );
    });

    it('returns undefined for a tool nobody claimed', () => {
        COPILOT_TOOL_RESULT_SLOT._register([
            item('alarms', 'admin_alarms_findings')
        ]);
        // The overwhelmingly common case: most tools have no rich rendering,
        // and `ToolStep` must fall through to the raw payload for them.
        expect(toolResultRendererFor('admin_content_search')).toBeUndefined();
    });

    it('returns undefined when nothing is registered at all', () => {
        expect(toolResultRendererFor('admin_alarms_findings')).toBeUndefined();
    });

    it('does not match a prefix or a near-miss', () => {
        COPILOT_TOOL_RESULT_SLOT._register([
            item('alarms', 'admin_alarms_findings')
        ]);
        expect(toolResultRendererFor('admin_alarms')).toBeUndefined();
        expect(
            toolResultRendererFor('admin_alarms_findings_v2')
        ).toBeUndefined();
        // An MCP connector's namespaced tool must not be captured either.
        expect(
            toolResultRendererFor('mcp.other.admin_alarms_findings')
        ).toBeUndefined();
    });

    it('gives the last registration the tool on a collision', () => {
        // Two plugins claiming one tool name is a misconfiguration; last-wins
        // matches the other merge-by-id slots rather than inventing a third
        // rule for it.
        COPILOT_TOOL_RESULT_SLOT._register([
            item('first', 'admin_alarms_findings'),
            item('second', 'admin_alarms_findings')
        ]);
        expect(toolResultRendererFor('admin_alarms_findings')?.id).toBe(
            'second'
        );
    });

    it('keeps contributions for different tools apart', () => {
        COPILOT_TOOL_RESULT_SLOT._register([
            item('alarms', 'admin_alarms_findings'),
            item('media', 'media_assets_search')
        ]);
        expect(toolResultRendererFor('admin_alarms_findings')?.id).toBe(
            'alarms'
        );
        expect(toolResultRendererFor('media_assets_search')?.id).toBe('media');
    });

    it('hands out a copy, so a consumer cannot rewrite the registry', () => {
        COPILOT_TOOL_RESULT_SLOT._register([
            item('alarms', 'admin_alarms_findings')
        ]);
        COPILOT_TOOL_RESULT_SLOT.getItems().length = 0;
        expect(toolResultRendererFor('admin_alarms_findings')).toBeDefined();
    });
});
