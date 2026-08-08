import { Logger } from '@nestjs/common';
import {
    execute,
    GraphQLError,
    parse,
    specifiedRules,
    validate,
    type DocumentNode,
    type ExecutionResult,
    type GraphQLSchema
} from 'graphql';
import type { GraphqlContext } from '../resolvers/context';
import type { ContentGraphqlLimits } from '../types/config';
import { toGraphQLError } from './errors';
import { checkLimits } from './limits';

/** One operation to run. */
export interface GraphqlOperation {
    query: string;
    variables?: Record<string, unknown>;
    operationName?: string;
}

/**
 * Parses, cost-checks, validates, and executes one operation.
 *
 * The order is deliberate and is the cheapest-first rule: a length check needs
 * no parse, the cost check needs no schema, and validation needs no database.
 * An abusive document is refused at the first gate it fails, so the expensive
 * stages only ever see documents that earned them.
 *
 * Errors surfacing from resolvers are mapped through {@link toGraphQLError}, so
 * a `NotFoundException` from the shared read path reads as `NOT_FOUND` with the
 * status the REST route would have returned, and an unexpected error reads as
 * nothing at all.
 */
export async function executeOperation(
    schema: GraphQLSchema,
    operation: GraphqlOperation,
    context: GraphqlContext,
    limits: ContentGraphqlLimits,
    logger: Logger
): Promise<ExecutionResult> {
    if (operation.query.length > limits.maxQueryLength) {
        return {
            errors: [
                new GraphQLError(
                    `Query document is ${operation.query.length} characters; the limit is ${limits.maxQueryLength}.`,
                    { extensions: { code: 'GRAPHQL_LIMIT_EXCEEDED' } }
                )
            ]
        };
    }

    let document: DocumentNode;
    try {
        document = parse(operation.query);
    } catch (error) {
        return {
            errors: [
                error instanceof GraphQLError
                    ? error
                    : new GraphQLError('Could not parse the query document.', {
                          extensions: { code: 'GRAPHQL_PARSE_FAILED' }
                      })
            ]
        };
    }

    const variables = operation.variables ?? {};
    const overBudget = checkLimits(
        document,
        operation.operationName,
        variables,
        limits
    );
    if (overBudget.length > 0) {
        return { errors: overBudget };
    }

    const invalid = validate(schema, document, specifiedRules);
    if (invalid.length > 0) {
        // A field naming an ungranted content type lands here — the type is
        // absent from this workspace's schema, so it is "no such field" rather
        // than a 404, which is a stronger guarantee than REST manages: the
        // request never reaches a resolver at all.
        return { errors: [...invalid] };
    }

    const result = await execute({
        schema,
        document,
        contextValue: context,
        variableValues: variables,
        ...(operation.operationName
            ? { operationName: operation.operationName }
            : {})
    });

    if (!result.errors || result.errors.length === 0) {
        return result;
    }
    return {
        ...result,
        errors: result.errors
            .map((error) => toGraphQLError(error, logger))
            .filter((error): error is GraphQLError => error !== null)
    };
}
