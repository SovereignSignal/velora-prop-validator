export interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  snapshot: string;
  state: 'pending' | 'active' | 'closed';
  author: string;
  created: number;
  space: SnapshotSpace;
  strategies: SnapshotStrategy[];
  plugins?: Record<string, any>;
  network?: string;
  type?: string;
}

export interface SnapshotSpace {
  id: string;
  name: string;
  network?: string;
  symbol?: string;
  members?: string[];
}

export interface SnapshotStrategy {
  name: string;
  network: string;
  params: Record<string, any>;
}

export interface SnapshotGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: any;
  }>;
}