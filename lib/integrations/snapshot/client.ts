import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { SnapshotProposal, SnapshotGraphQLResponse } from '@/types/snapshot';
import { SnapshotError } from '@/types/errors';

export class SnapshotClient {
  private client: any;
  
  constructor(endpoint: string = 'https://hub.snapshot.org/graphql') {
    // Create Apollo Client with proper configuration
    // Create HTTP link for the GraphQL endpoint
    const httpLink = createHttpLink({
      uri: endpoint,
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
      const result = await this.client.query({
        query: PROPOSAL_QUERY,
        variables: { id: proposalId }
      });
      
      if (!result.data?.proposal) {
        throw new SnapshotError(`Proposal not found: ${proposalId}`, proposalId);
      }
      
      return result.data.proposal as SnapshotProposal;
    } catch (error) {
      if (error instanceof SnapshotError) {
        throw error;
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
    // Match various Snapshot URL formats
    const patterns = [
      /snapshot\.org\/#\/[^/]+\/proposal\/([^/?]+)/,
      /snapshot\.page\/#\/[^/]+\/proposal\/([^/?]+)/,
      /snapshot\.box\/#\/[^/]+\/proposal\/([^/?]+)/,
      /proposal\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // If no pattern matches, check if it's already a proposal ID
    if (/^0x[a-fA-F0-9]{64}$/.test(url) || /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(url)) {
      return url;
    }
    
    return null;
  }
  
  /**
   * Extracts space name from a Snapshot URL
   */
  static extractSpaceName(url: string): string | null {
    // Match space name from URL
    const patterns = [
      /snapshot\.org\/#\/([^/]+)\/proposal/,
      /snapshot\.page\/#\/([^/]+)\/proposal/,
      /snapshot\.box\/#\/([^/]+)\/proposal/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
}