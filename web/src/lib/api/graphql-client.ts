import { GraphQLClient } from 'graphql-request';

function getEndpoint(): string {
  const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  if (!endpoint) {
    throw new Error('NEXT_PUBLIC_GRAPHQL_ENDPOINT is not defined in environment variables');
  }
  return endpoint;
}

let _client: GraphQLClient | null = null;

export const graphqlClient = {
  request: <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
    if (!_client) {
      _client = new GraphQLClient(getEndpoint(), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    return _client.request<T>(query, variables);
  },
};
