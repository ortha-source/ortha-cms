export { CopilotPlugin } from './lib/presentation/copilotPlugin';
export type { CopilotAdminPlugin } from './lib/presentation/copilotPlugin';

// The panel and its launcher, exported so a future entry point (the ⌘K
// palette, the entry editor) can mount the same surface rather than build a
// second one.
export { CopilotPanel } from './lib/presentation/CopilotPanel';
export type { CopilotPanelProps } from './lib/presentation/CopilotPanel';
export { CopilotLauncher } from './lib/presentation/CopilotLauncher';

// The transport and the chat state, exported for the same reason: an inline
// surface reuses the run stream instead of reimplementing SSE over fetch.
export { streamRun, CopilotRunError } from './lib/application/runStream';
export type {
    StartRunRequest,
    StartRunOptions
} from './lib/application/runStream';
export { useCopilotChat } from './lib/application/useCopilotChat';
export type { CopilotChat } from './lib/application/useCopilotChat';
export {
    useConversations,
    conversationsKey
} from './lib/application/useConversations';
export type { CopilotConversation } from './lib/application/useConversations';
export {
    useCopilotModels,
    copilotModelsKey,
    modelChoiceKey,
    parseModelChoiceKey
} from './lib/application/useCopilotModels';
export type {
    CopilotModelChoice,
    CopilotModelCatalogue
} from './lib/application/useCopilotModels';
export { ModelPicker } from './lib/presentation/ModelPicker';
export type {
    ChatMessage,
    ChatProposal,
    ChatToolStep
} from './lib/domain/types/chat';

// The receipt for a change the copilot made. Exported for the same reason the
// chat state is: a future inline surface (the entry editor's "suggest alt
// text") renders the same card rather than inventing a second way to tell
// someone their content changed.
export { ProposalCard } from './lib/presentation/ProposalCard';
// Where the user is, derived from the URL. Exported so a future inline surface
// (the ⌘K palette, an entry-editor widget) reports the same context rather than
// inventing its own.
export { useRouteContext } from './lib/application/useRouteContext';
export { readRouteContext } from './lib/application/readRouteContext';
export type { RouteContext } from './lib/application/readRouteContext';
