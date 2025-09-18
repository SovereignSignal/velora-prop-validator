export interface DistributionData {
  address: string;
  amount: string;
  index?: number;
  metadata?: Record<string, any>;
}

export interface Distribution {
  id: string;
  recipients: DistributionData[];
  merkleRoot?: string;
  totalAmount?: string;
  createdAt?: string;
  format?: 'openzeppelin' | 'uniswap' | 'custom';
}

export interface MerkleTreeData {
  root: string;
  leaves: string[];
  tree: any; // MerkleTree instance
  proofs: Map<string, string[]>;
}