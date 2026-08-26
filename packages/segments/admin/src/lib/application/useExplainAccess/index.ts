import { useMutation } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import type { ExplainAccessInput } from '../../infrastructure/segmentsGateway';

/**
 * "What would this reader see, and why" — the simulator behind the Access tab.
 *
 * A **mutation**, not a query, and not because it writes anything. It is
 * imperative: the editor types a set of tags and presses a button, and the
 * answer is about that moment. Modelled as a query it would be keyed by the
 * tags, cached, and served stale to the next person asking the same question
 * after the rule changed — which is the one wrong answer this panel exists to
 * prevent.
 */
export function useExplainAccess() {
    return useMutation({
        mutationFn: (input: ExplainAccessInput) =>
            httpSegmentsGateway.explain(input)
    });
}
