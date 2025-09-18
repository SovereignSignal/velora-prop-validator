import { SnapshotProposal } from '@/types/snapshot';

export interface ProposalData {
  merkleRoot?: string;
  ipfsUrl?: string;
  githubUrl?: string;
  distributionUrl?: string;
  totalAmount?: string;
  recipientCount?: number;
  distributionData?: any; // Cached distribution data from IPFS fetch
}

/**
 * Parses a Snapshot proposal to extract merkle root and distribution data
 */
export function parseProposal(proposal: SnapshotProposal): ProposalData {
  const data: ProposalData = {};
  
  // Extract from proposal body
  const body = proposal.body;
  console.log('[parseProposal] Parsing proposal body of length:', body.length);
  
  // Extract merkle root (various formats)
  const merkleRootPatterns = [
    // Standard formats
    /merkle\s*root[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    /merkleRoot[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    /root[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    // JSON formats
    /"merkleRoot"[:\s]*"(?:0x)?([a-fA-F0-9]{64})"/i,
    /"merkle_root"[:\s]*"(?:0x)?([a-fA-F0-9]{64})"/i,
    // Code blocks
    /```[\s\S]*?merkleRoot[:\s]+(?:0x)?([a-fA-F0-9]{64})[\s\S]*?```/i,
    /```json[\s\S]*?"merkleRoot"[:\s]*"(?:0x)?([a-fA-F0-9]{64})"[\s\S]*?```/i,
    // Table format
    /\|\s*Merkle\s*Root\s*\|\s*(?:0x)?([a-fA-F0-9]{64})\s*\|/i,
    // Inline code
    /`(?:0x)?([a-fA-F0-9]{64})`.*merkle/i,
    // Bold/emphasis formats
    /\*\*Merkle\s*Root\*\*[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    // Distribution or Treasury Redemption specific
    /Treasury\s+Merkle\s+Root[:\s]+(?:0x)?([a-fA-F0-9]{64})/i,
    /Distribution\s+Root[:\s]+(?:0x)?([a-fA-F0-9]{64})/i
  ];
  
  for (const pattern of merkleRootPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      data.merkleRoot = `0x${match[1].toLowerCase()}`;
      console.log('[parseProposal] Found merkle root:', data.merkleRoot);
      break;
    }
  }
  
  if (!data.merkleRoot) {
    console.log('[parseProposal] No merkle root found with standard patterns');
  }
  
  // Extract IPFS URLs
  const ipfsPatterns = [
    // Direct IPFS hashes
    /ipfs[:/]+([Qm][1-9A-HJ-NP-Za-km-z]{44})/g,
    /ipfs[:/]+([a-z0-9]{46,})/g,
    // Gateway URLs
    /(https?:\/\/[^/\s]+\/ipfs\/[Qm][1-9A-HJ-NP-Za-km-z]{44}[^\s\)]*)/g,
    /(https?:\/\/[^/\s]+\/ipfs\/[a-z0-9]{46,}[^\s\)]*)/g,
    // Common gateways
    /(https?:\/\/gateway\.pinata\.cloud\/ipfs\/[^\s\)]+)/g,
    /(https?:\/\/ipfs\.io\/ipfs\/[^\s\)]+)/g,
    /(https?:\/\/cloudflare-ipfs\.com\/ipfs\/[^\s\)]+)/g,
    // Markdown links with IPFS
    /\[.*?\]\((.*?ipfs[:/][^\)]+)\)/g,
    // Arweave URLs (sometimes used instead of IPFS)
    /(https?:\/\/arweave\.net\/[^\s\)]+)/g
  ];
  
  for (const pattern of ipfsPatterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !data.ipfsUrl) {
        data.ipfsUrl = match[1];
        console.log('[parseProposal] Found IPFS URL:', data.ipfsUrl);
        break;
      }
    }
    if (data.ipfsUrl) break;
  }
  
  if (!data.ipfsUrl) {
    console.log('[parseProposal] No IPFS URL found');
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
    console.log('[parseProposal] Checking plugins:', Object.keys(proposal.plugins));
    
    // Check for oSnap plugin (optimistic snapshot)
    if (proposal.plugins.oSnap) {
      const oSnapData = proposal.plugins.oSnap;
      console.log('[parseProposal] oSnap plugin detected:', oSnapData);
      
      // oSnap proposals often have the IPFS hash in the plugin data
      if (typeof oSnapData === 'string') {
        // Check if it's an IPFS hash
        if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|[a-z0-9]{46,})$/.test(oSnapData) && !data.ipfsUrl) {
          data.ipfsUrl = oSnapData;
          console.log('[parseProposal] Found IPFS hash in oSnap data:', oSnapData);
        }
        // Check if it's a merkle root
        else if (/^(?:0x)?[a-fA-F0-9]{64}$/.test(oSnapData) && !data.merkleRoot) {
          data.merkleRoot = oSnapData.startsWith('0x') ? oSnapData.toLowerCase() : `0x${oSnapData.toLowerCase()}`;
          console.log('[parseProposal] Found merkle root in oSnap data:', data.merkleRoot);
        }
      } else if (typeof oSnapData === 'object') {
        // Look for IPFS or merkle root in oSnap object
        const oSnapString = JSON.stringify(oSnapData);
        
        // Look for IPFS hashes
        const ipfsMatch = oSnapString.match(/(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{46,})/);
        if (ipfsMatch && !data.ipfsUrl) {
          data.ipfsUrl = ipfsMatch[1];
          console.log('[parseProposal] Found IPFS hash in oSnap object:', data.ipfsUrl);
        }
        
        // Look for merkle roots
        const merkleMatch = oSnapString.match(/(?:merkle[Rr]oot|root)["\s:]+(?:0x)?([a-fA-F0-9]{64})/);
        if (merkleMatch && !data.merkleRoot) {
          data.merkleRoot = `0x${merkleMatch[1].toLowerCase()}`;
          console.log('[parseProposal] Found merkle root in oSnap object:', data.merkleRoot);
        }
      }
    }
    
    // Check for SafeSnap plugin
    if (proposal.plugins.safeSnap) {
      const safeSnapData = proposal.plugins.safeSnap;
      console.log('[parseProposal] SafeSnap plugin detected');
      
      // SafeSnap might contain transaction data
      if (typeof safeSnapData === 'object' && 'txs' in safeSnapData) {
        // Parse transaction data for merkle distributor calls
        console.log('[parseProposal] SafeSnap contains transaction data');
        // Try to extract merkle root from transaction data
        const txData = JSON.stringify(safeSnapData);
        const txMerkleMatch = txData.match(/(?:0x)?([a-fA-F0-9]{64})/);
        if (txMerkleMatch && !data.merkleRoot) {
          data.merkleRoot = `0x${txMerkleMatch[1].toLowerCase()}`;
          console.log('[parseProposal] Found merkle root in SafeSnap data:', data.merkleRoot);
        }
      }
    }
    
    // Check for other plugins that might contain distribution data
    if (proposal.plugins.poap) {
      console.log('[parseProposal] POAP plugin detected');
    }
  }
  
  // Additional pattern: Look for IPFS CIDs without typical markers
  if (!data.ipfsUrl) {
    // Match standalone IPFS CIDs (base58 Qm... or base32 baf...)
    const standaloneIPFS = body.match(/(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{46,})/);
    if (standaloneIPFS) {
      data.ipfsUrl = standaloneIPFS[1];
      console.log('[parseProposal] Found standalone IPFS CID:', data.ipfsUrl);
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
  
  console.log('[validateProposalData] Validating proposal data:', data);
  
  // Check for merkle root
  if (!data.merkleRoot) {
    errors.push('No merkle root found in proposal. The proposal body should contain a merkle root in format: 0x[64 hex characters]');
  } else if (!/^0x[a-fA-F0-9]{64}$/.test(data.merkleRoot)) {
    errors.push(`Invalid merkle root format: ${data.merkleRoot}. Expected format: 0x followed by 64 hexadecimal characters`);
  }
  
  // Check for distribution data URL
  if (!data.ipfsUrl && !data.githubUrl && !data.distributionUrl) {
    errors.push('No distribution data URL found in proposal. The proposal should contain an IPFS link, GitHub link, or other URL to the distribution data');
  }
  
  // Warnings
  if (data.recipientCount && data.recipientCount > 100000) {
    warnings.push(`Large distribution with ${data.recipientCount} recipients may take longer to verify`);
  }
  
  if (!data.totalAmount) {
    warnings.push('Total distribution amount not found in proposal');
  }
  
  console.log('[validateProposalData] Validation result - Valid:', errors.length === 0, 'Errors:', errors.length, 'Warnings:', warnings.length);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}