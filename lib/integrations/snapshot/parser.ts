import { SnapshotProposal } from '@/types/snapshot';

export interface ProposalData {
  merkleRoot?: string;
  ipfsUrl?: string;
  githubUrl?: string;
  distributionUrl?: string;
  totalAmount?: string;
  recipientCount?: number;
}

/**
 * Parses a Snapshot proposal to extract merkle root and distribution data
 */
export function parseProposal(proposal: SnapshotProposal): ProposalData {
  const data: ProposalData = {};
  
  // Extract from proposal body
  const body = proposal.body;
  
  // Extract merkle root (various formats)
  const merkleRootPatterns = [
    /merkle\s*root[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    /merkleRoot[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    /root[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    /"merkleRoot"[:\s]*"(?:0x)?([a-fA-F0-9]{64})"/i,
    /`(?:0x)?([a-fA-F0-9]{64})`.*merkle/i
  ];
  
  for (const pattern of merkleRootPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      data.merkleRoot = `0x${match[1].toLowerCase()}`;
      break;
    }
  }
  
  // Extract IPFS URLs
  const ipfsPatterns = [
    /ipfs[:/]+([Qm][1-9A-HJ-NP-Za-km-z]{44})/g,
    /ipfs[:/]+([a-z0-9]{46,})/g,
    /(https?:\/\/[^/\s]+\/ipfs\/[Qm][1-9A-HJ-NP-Za-km-z]{44}[^\s]*)/g,
    /(https?:\/\/[^/\s]+\/ipfs\/[a-z0-9]{46,}[^\s]*)/g,
    /\[.*?\]\((.*?ipfs.*?)\)/g // Markdown links
  ];
  
  for (const pattern of ipfsPatterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !data.ipfsUrl) {
        data.ipfsUrl = match[1];
        break;
      }
    }
    if (data.ipfsUrl) break;
  }
  
  // Extract GitHub URLs
  const githubPatterns = [
    /(https?:\/\/(?:raw\.)?github(?:usercontent)?\.com\/[^\s\)]+\.json)/g,
    /(https?:\/\/github\.com\/[^\s\)]+\.json)/g,
    /\[.*?\]\((.*?github.*?\.json.*?)\)/g // Markdown links
  ];
  
  for (const pattern of githubPatterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !data.githubUrl) {
        data.githubUrl = match[1];
        break;
      }
    }
    if (data.githubUrl) break;
  }
  
  // Extract distribution URL (generic)
  if (!data.ipfsUrl && !data.githubUrl) {
    const distributionPatterns = [
      /distribution[:\s]+<?([https?:\/\/[^\s>]+)>?/i,
      /recipients[:\s]+<?([https?:\/\/[^\s>]+)>?/i,
      /airdrop[:\s]+<?([https?:\/\/[^\s>]+)>?/i,
      /\[.*?distribution.*?\]\((https?:\/\/[^\)]+)\)/i,
      /\[.*?recipients.*?\]\((https?:\/\/[^\)]+)\)/i
    ];
    
    for (const pattern of distributionPatterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        data.distributionUrl = match[1];
        break;
      }
    }
  }
  
  // Extract total amount
  const amountPatterns = [
    /total[:\s]+([0-9,\.]+)\s*(?:tokens?|[A-Z]{2,})/i,
    /distribut\w*[:\s]+([0-9,\.]+)\s*(?:tokens?|[A-Z]{2,})/i,
    /amount[:\s]+([0-9,\.]+)\s*(?:tokens?|[A-Z]{2,})/i
  ];
  
  for (const pattern of amountPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      data.totalAmount = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract recipient count
  const recipientPatterns = [
    /([0-9,]+)\s*(?:recipients?|addresses|wallets?|users?)/i,
    /recipients?[:\s]+([0-9,]+)/i,
    /addresses[:\s]+([0-9,]+)/i
  ];
  
  for (const pattern of recipientPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      data.recipientCount = parseInt(match[1].replace(/,/g, ''), 10);
      break;
    }
  }
  
  // Check plugins for additional data
  if (proposal.plugins) {
    // Check for SafeSnap plugin
    if (proposal.plugins.safeSnap) {
      const safeSnapData = proposal.plugins.safeSnap;
      // SafeSnap might contain transaction data
      if (typeof safeSnapData === 'object' && 'txs' in safeSnapData) {
        // Parse transaction data for merkle distributor calls
        console.log('SafeSnap plugin detected, checking for merkle distributor transactions');
      }
    }
  }
  
  return data;
}

/**
 * Determines the best URL to fetch distribution data from
 */
export function getDistributionUrl(proposalData: ProposalData): string | null {
  // Priority: IPFS > GitHub > Generic distribution URL
  if (proposalData.ipfsUrl) {
    return proposalData.ipfsUrl;
  }
  
  if (proposalData.githubUrl) {
    // Convert GitHub URLs to raw format if needed
    const githubUrl = proposalData.githubUrl;
    if (githubUrl.includes('github.com') && !githubUrl.includes('raw.githubusercontent.com')) {
      return githubUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }
    return githubUrl;
  }
  
  if (proposalData.distributionUrl) {
    return proposalData.distributionUrl;
  }
  
  return null;
}

/**
 * Validates extracted proposal data
 */
export function validateProposalData(data: ProposalData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for merkle root
  if (!data.merkleRoot) {
    errors.push('No merkle root found in proposal');
  } else if (!/^0x[a-fA-F0-9]{64}$/.test(data.merkleRoot)) {
    errors.push('Invalid merkle root format');
  }
  
  // Check for distribution data URL
  if (!data.ipfsUrl && !data.githubUrl && !data.distributionUrl) {
    errors.push('No distribution data URL found in proposal');
  }
  
  // Warnings
  if (data.recipientCount && data.recipientCount > 100000) {
    warnings.push(`Large distribution with ${data.recipientCount} recipients may take longer to verify`);
  }
  
  if (!data.totalAmount) {
    warnings.push('Total distribution amount not found in proposal');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}