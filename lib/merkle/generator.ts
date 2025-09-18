import { keccak256, solidityPackedKeccak256, AbiCoder } from 'ethers';
import MerkleTree from 'merkletreejs';
import { DistributionData, MerkleTreeData } from '@/types/distribution';
import { MerkleTreeError } from '@/types/errors';

const abiCoder = new AbiCoder();

export type MerkleFormat = 'openzeppelin' | 'uniswap' | 'custom';

/**
 * Generates a merkle tree from distribution data
 * Supports multiple formats used by different DAOs
 */
export function generateMerkleTree(
  distribution: DistributionData[],
  format: MerkleFormat = 'custom'
): MerkleTreeData {
  if (!distribution || distribution.length === 0) {
    throw new MerkleTreeError('Distribution data is empty', format);
  }

  // Generate leaves based on format
  const leaves = distribution.map((item, index) => {
    return generateLeaf(item, index, format);
  });

  // Create merkle tree with keccak256 hashing
  const tree = new MerkleTree(leaves, keccak256, { 
    sortPairs: true,
    hashLeaves: false // We already hash in generateLeaf
  });

  // Generate proofs for each recipient
  const proofs = new Map<string, string[]>();
  distribution.forEach((item, index) => {
    const leaf = leaves[index];
    const proof = tree.getHexProof(leaf);
    proofs.set(item.address.toLowerCase(), proof);
  });

  return {
    root: tree.getHexRoot(),
    leaves: leaves.map(l => l.toString()),
    tree,
    proofs
  };
}

/**
 * Generates a leaf node based on the specified format
 */
export function generateLeaf(
  item: DistributionData,
  index: number,
  format: MerkleFormat
): string {
  const address = item.address.toLowerCase();
  const amount = item.amount;

  switch (format) {
    case 'openzeppelin':
      // OpenZeppelin uses double hashing
      // keccak256(keccak256(abi.encode(address, amount)))
      const encoded = abiCoder.encode(
        ['address', 'uint256'],
        [address, amount]
      );
      return keccak256(keccak256(encoded));

    case 'uniswap':
      // Uniswap includes index in the leaf
      // keccak256(abi.encode(index, address, amount))
      return keccak256(
        abiCoder.encode(
          ['uint256', 'address', 'uint256'],
          [index, address, amount]
        )
      );

    case 'custom':
    default:
      // Simple packed encoding
      // keccak256(abi.encodePacked(address, amount))
      return solidityPackedKeccak256(
        ['address', 'uint256'],
        [address, amount]
      );
  }
}

/**
 * Verifies a merkle proof for a specific recipient
 */
export function verifyProof(
  address: string,
  amount: string,
  proof: string[],
  root: string,
  format: MerkleFormat = 'custom',
  index?: number
): boolean {
  const item: DistributionData = { address, amount, index };
  const leaf = generateLeaf(item, index || 0, format);
  
  // Reconstruct root from proof
  let computedHash = leaf;
  
  for (const proofElement of proof) {
    if (computedHash < proofElement) {
      // Hash(current, proof)
      computedHash = keccak256(computedHash + proofElement.slice(2));
    } else {
      // Hash(proof, current)
      computedHash = keccak256(proofElement + computedHash.slice(2));
    }
  }
  
  return computedHash.toLowerCase() === root.toLowerCase();
}

/**
 * Detects the format of a merkle tree by testing different encodings
 */
export function detectMerkleFormat(
  sampleData: DistributionData[],
  expectedRoot: string
): MerkleFormat | null {
  const formats: MerkleFormat[] = ['openzeppelin', 'uniswap', 'custom'];
  
  for (const format of formats) {
    try {
      const tree = generateMerkleTree(sampleData.slice(0, 10), format);
      if (tree.root.toLowerCase() === expectedRoot.toLowerCase()) {
        return format;
      }
    } catch (error) {
      // Continue trying other formats
    }
  }
  
  return null;
}