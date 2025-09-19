import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { SnapshotProposal, SnapshotGraphQLResponse } from '@/types/snapshot';
import { SnapshotError } from '@/types/errors';
import fetch from 'cross-fetch';

export class SnapshotClient {
  private client: any;
  
  constructor(endpoint: string = 'https://hub.snapshot.org/graphql') {
    console.log('[SnapshotClient] Initializing with endpoint:', endpoint);
    
    // Create HTTP link for the GraphQL endpoint with custom fetch
    const httpLink = createHttpLink({
      uri: endpoint,
      fetch,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Velora-Prop-Validator/1.0'
      }
    });
    
    // Initialize Apollo Client
    this.client = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
      defaultOptions: {
        query: {
          fetchPolicy: 'no-cache',
          errorPolicy: 'all'
        },
        watchQuery: {
          fetchPolicy: 'no-cache',
          errorPolicy: 'all'
        }
      }
    });
  }
  
  /**
   * Fetches a proposal by ID
   */
  async getProposal(proposalId: string): Promise<SnapshotProposal> {
    console.log('[SnapshotClient] Fetching proposal:', proposalId);
    
    const PROPOSAL_QUERY = gql`
      query Proposal($id: String!) {
        proposal(id: $id) {
          id
          title
          body
          choices
          start
          end
          snapshot
          state
          author
          created
          space {
            id
            name
            network
            symbol
            members
          }
          strategies {
            name
            network
            params
          }
          plugins
          network
          type
          scores
          scores_total
          scores_updated
        }
      }
    `;
    
    try {
      console.log('[SnapshotClient] Executing GraphQL query for proposal:', proposalId);
      const result = await this.client.query({
        query: PROPOSAL_QUERY,
        variables: { id: proposalId }
      });
      
      console.log('[SnapshotClient] GraphQL query result:', result.data ? 'Data received' : 'No data');
      
      if (!result.data?.proposal) {
        console.error('[SnapshotClient] Proposal not found in response');
        throw new SnapshotError(`Proposal not found: ${proposalId}`, proposalId);
      }
      
      console.log('[SnapshotClient] Successfully fetched proposal:', result.data.proposal.title);
      return result.data.proposal as SnapshotProposal;
    } catch (error) {
      console.error('[SnapshotClient] Error fetching proposal:', error);
      
      if (error instanceof SnapshotError) {
        throw error;
      }
      
      // Check for Apollo/GraphQL errors
      if (error && typeof error === 'object') {
        const apolloError = error as any;
        if (apolloError.graphQLErrors) {
          console.error('[SnapshotClient] GraphQL errors:', apolloError.graphQLErrors);
        }
        if (apolloError.networkError) {
          console.error('[SnapshotClient] Network error:', apolloError.networkError);
        }
      }
      
      throw new SnapshotError(
        `Failed to fetch proposal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        proposalId
      );
    }
  }
  
  /**
   * Fetches multiple proposals
   */
  async getProposals(options: {
    space?: string;
    state?: 'pending' | 'active' | 'closed';
    first?: number;
    skip?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  } = {}): Promise<SnapshotProposal[]> {
    const PROPOSALS_QUERY = gql`
      query Proposals(
        $space: String,
        $state: String,
        $first: Int,
        $skip: Int,
        $orderBy: String,
        $orderDirection: OrderDirection
      ) {
        proposals(
          where: {
            space: $space,
            state: $state
          },
          first: $first,
          skip: $skip,
          orderBy: $orderBy,
          orderDirection: $orderDirection
        ) {
          id
          title
          body
          choices
          start
          end
          snapshot
          state
          author
          created
          space {
            id
            name
            network
          }
          scores_total
        }
      }
    `;
    
    try {
      const result = await this.client.query({
        query: PROPOSALS_QUERY,
        variables: {
          space: options.space,
          state: options.state,
          first: options.first || 20,
          skip: options.skip || 0,
          orderBy: options.orderBy || 'created',
          orderDirection: options.orderDirection || 'desc'
        }
      });
      
      return result.data?.proposals || [];
    } catch (error) {
      throw new SnapshotError(
        `Failed to fetch proposals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Extracts proposal ID from a Snapshot URL
   */
  static extractProposalId(url: string): string | null {
    console.log('[SnapshotClient] Extracting proposal ID from URL:', url);
    
    // Match various Snapshot URL formats with hash routing
    const patterns = [
      // Hash-based routing (most common)
      /snapshot\.org\/#\/[^/]+\/proposal\/(0x[a-fA-F0-9]{64}|Qm[1-9A-HJ-NP-Za-km-z]{44})/,
      /snapshot\.page\/#\/[^/]+\/proposal\/(0x[a-fA-F0-9]{64}|Qm[1-9A-HJ-NP-Za-km-z]{44})/,
      /snapshot\.box\/#\/[^/]+\/proposal\/(0x[a-fA-F0-9]{64}|Qm[1-9A-HJ-NP-Za-km-z]{44})/,
      // Non-hash routing (legacy)
      /snapshot\.org\/[^/]+\/proposal\/(0x[a-fA-F0-9]{64}|Qm[1-9A-HJ-NP-Za-km-z]{44})/,
      // Generic proposal pattern
      /proposal\/(0x[a-fA-F0-9]{64}|Qm[1-9A-HJ-NP-Za-km-z]{44})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        console.log('[SnapshotClient] Extracted proposal ID:', match[1]);
        return match[1];
      }
    }
    
    // If no pattern matches, check if it's already a proposal ID
    if (/^0x[a-fA-F0-9]{64}$/.test(url) || /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(url)) {
      console.log('[SnapshotClient] URL is already a proposal ID:', url);
      return url;
    }
    
    console.error('[SnapshotClient] Failed to extract proposal ID from URL:', url);
    return null;
  }
  
  /**
   * Extracts space name from a Snapshot URL
   */
  static extractSpaceName(url: string): string | null {
    console.log('[SnapshotClient] Extracting space name from URL:', url);
    
    // Match space name from URL with hash routing
    const patterns = [
      // Hash-based routing
      /snapshot\.org\/#\/([^/]+)\/proposal/,
      /snapshot\.page\/#\/([^/]+)\/proposal/,
      /snapshot\.box\/#\/([^/]+)\/proposal/,
      // Non-hash routing
      /snapshot\.org\/([^/]+)\/proposal/,
      /snapshot\.page\/([^/]+)\/proposal/,
      /snapshot\.box\/([^/]+)\/proposal/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        console.log('[SnapshotClient] Extracted space name:', match[1]);
        return match[1];
      }
    }
    
    console.log('[SnapshotClient] No space name found in URL');
    return null;
  }
}