export interface DistributionData {
  address: string;
  amount: string;
  index?: number;
  metadata?: Record<string, any>;
  // ParaSwap-specific fields
  cumulativeClaimableAmount?: string;
  claimableAmount?: string;
  paraBoostScore?: string;
  user?: string; // Alternative to address field
  account?: string; // Alternative to address field
}

export interface Distribution {
  id: string;
  recipients: DistributionData[];
  merkleRoot?: string;
  totalAmount?: string;
  createdAt?: string;
  format?: 'openzeppelin' | 'uniswap' | 'custom' | 'paraswap';
}

export interface MerkleTreeData {
  root: string;
  leaves: string[];
  tree: any; // MerkleTree instance
  proofs: Map<string, string[]>;
}