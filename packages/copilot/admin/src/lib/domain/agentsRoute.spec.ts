import {
    agentThreadPath,
    agentsPath,
    isAgentsPath,
    readAgentThreadId
} from './agentsRoute';

describe('agentsPath', () => {
    it('builds the base path for a workspace', () => {
        expect(agentsPath('ws-1')).toBe('/workspaces/ws-1/agents');
    });

    it('builds a thread deep link', () => {
        expect(agentThreadPath('ws-1', 'c-9')).toBe(
            '/workspaces/ws-1/agents/c-9'
        );
    });
});

describe('isAgentsPath', () => {
    it('matches the base and a thread', () => {
        expect(isAgentsPath('/workspaces/ws-1/agents')).toBe(true);
        expect(isAgentsPath('/workspaces/ws-1/agents/c-9')).toBe(true);
    });

    it('tolerates a trailing slash', () => {
        expect(isAgentsPath('/workspaces/ws-1/agents/')).toBe(true);
    });

    it('does not match other workspace sections', () => {
        expect(isAgentsPath('/workspaces/ws-1/content/article')).toBe(false);
        expect(isAgentsPath('/workspaces/ws-1')).toBe(false);
        expect(isAgentsPath('/workspaces')).toBe(false);
        expect(isAgentsPath('/')).toBe(false);
    });

    it('does not match a top-level look-alike', () => {
        expect(isAgentsPath('/agents')).toBe(false);
    });
});

describe('readAgentThreadId', () => {
    it('returns null at the base — that is the unsaved new chat', () => {
        expect(readAgentThreadId('/workspaces/ws-1/agents')).toBeNull();
    });

    it('returns the thread id', () => {
        expect(readAgentThreadId('/workspaces/ws-1/agents/c-9')).toBe('c-9');
    });

    it('returns null outside the Agents view', () => {
        expect(readAgentThreadId('/workspaces/ws-1/content/article/e-1')).toBe(
            null
        );
    });
});
