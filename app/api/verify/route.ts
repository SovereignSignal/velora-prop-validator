import { NextRequest, NextResponse } from 'next/server';
import { SnapshotClient } from '@/lib/integrations/snapshot/client';
import { parseProposal, getDistributionUrl, validateProposalData } from '@/lib/integrations/snapshot/parser';
import { IPFSGatewayManager } from '@/lib/integrations/ipfs/gateway';
import { createVerificationResult } from '@/lib/merkle/verifier';
import { DistributionData } from '@/types/distribution';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  console.log('[API /verify] Request received');
  
  try {
    const body = await request.json();
    const { url, type, ipfsHash, data, merkleRoot, format, manualMerkleRoot } = body;
    
    console.log('[API /verify] Request parameters:', {
      url,
      type,
      hasIpfsHash: !!ipfsHash,
      hasData: !!data,
      hasMerkleRoot: !!merkleRoot,
      format
    });

    let distribution: DistributionData[];
    let expectedRoot: string;
    let proposalId: string | undefined;
    let spaceName: string | undefined;

    if (type === 'manual') {
      // Manual verification mode
      if (type === 'ipfs' && ipfsHash) {
        const ipfsManager = new IPFSGatewayManager();
        const response = await ipfsManager.fetch(ipfsHash);
        distribution = parseDistributionData(response.data);
      } else if (type === 'file' && data) {
        distribution = parseDistributionData(data);
      } else {
        return NextResponse.json(
          { error: 'Invalid manual verification parameters' },
          { status: 400 }
        );
      }
      
      expectedRoot = merkleRoot;
    } else {
      // Snapshot URL verification
      const extractedProposalId = SnapshotClient.extractProposalId(url);
      const extractedSpaceName = SnapshotClient.extractSpaceName(url);

      if (!extractedProposalId) {
        return NextResponse.json(
          { 
            error: 'Invalid Snapshot URL format',
            details: `Could not extract proposal ID from URL: ${url}`,
            supportedFormats: [
              'https://snapshot.org/#/space.eth/proposal/0x...',
              'https://snapshot.org/#/space.eth/proposal/Qm...',
              'https://snapshot.page/#/space.eth/proposal/0x...',
              'https://snapshot.box/#/space.eth/proposal/0x...'
            ],
            receivedUrl: url
          },
          { status: 400 }
        );
      }
      
      proposalId = extractedProposalId;
      spaceName = extractedSpaceName || undefined;

      // Fetch proposal from Snapshot
      console.log('[API /verify] Fetching proposal from Snapshot:', proposalId);
      const snapshotClient = new SnapshotClient();
      const proposal = await snapshotClient.getProposal(proposalId);
      
      console.log('[API /verify] Proposal fetched:', {
        title: proposal.title,
        bodyLength: proposal.body.length,
        hasPlugins: !!proposal.plugins,
        state: proposal.state
      });

      // Parse proposal to extract merkle root and distribution URL
      console.log('[API /verify] Parsing proposal data');
      const proposalData = parseProposal(proposal);
      
      console.log('[API /verify] Parsed proposal data:', {
        hasMerkleRoot: !!proposalData.merkleRoot,
        merkleRoot: proposalData.merkleRoot,
        hasIpfsUrl: !!proposalData.ipfsUrl,
        hasGithubUrl: !!proposalData.githubUrl,
        hasDistributionUrl: !!proposalData.distributionUrl
      });
      
      // Allow manual merkle root override
      if (manualMerkleRoot && /^(?:0x)?[a-fA-F0-9]{64}$/.test(manualMerkleRoot)) {
        proposalData.merkleRoot = manualMerkleRoot.startsWith('0x') ? manualMerkleRoot.toLowerCase() : `0x${manualMerkleRoot.toLowerCase()}`;
        console.log('[API /verify] Using manually provided merkle root:', proposalData.merkleRoot);
      }
      
      // If no merkle root found in proposal body, try to fetch from distribution data
      if (!proposalData.merkleRoot && (proposalData.ipfsUrl || proposalData.githubUrl || proposalData.distributionUrl)) {
        console.log('[API /verify] No merkle root in proposal body, attempting to fetch from distribution data');
        
        try {
          const distributionUrl = getDistributionUrl(proposalData);
          if (distributionUrl) {
            const ipfsManager = new IPFSGatewayManager();
            const response = await ipfsManager.fetch(distributionUrl);
            
            // Look for merkle root in the fetched data
            if (typeof response.data === 'object' && response.data !== null) {
              // Check common merkle root property names
              const merkleRootKeys = ['merkleRoot', 'merkle_root', 'root', 'merkleTreeRoot'];
              for (const key of merkleRootKeys) {
                if (response.data[key] && typeof response.data[key] === 'string') {
                  const potentialRoot = response.data[key];
                  if (/^(?:0x)?[a-fA-F0-9]{64}$/.test(potentialRoot)) {
                    proposalData.merkleRoot = potentialRoot.startsWith('0x') ? potentialRoot.toLowerCase() : `0x${potentialRoot.toLowerCase()}`;
                    console.log('[API /verify] Found merkle root in distribution data:', proposalData.merkleRoot);
                    
                    // Also store the fetched data for later use when parsing distribution
                    proposalData.distributionData = response.data;
                    break;
                  }
                }
              }
              
              // Also check if the data itself is the merkle root (single string)
              if (!proposalData.merkleRoot && typeof response.data === 'string' && /^(?:0x)?[a-fA-F0-9]{64}$/.test(response.data)) {
                proposalData.merkleRoot = response.data.startsWith('0x') ? response.data.toLowerCase() : `0x${response.data.toLowerCase()}`;
                console.log('[API /verify] Distribution data is the merkle root itself:', proposalData.merkleRoot);
              }
            }
          }
        } catch (error) {
          console.error('[API /verify] Failed to fetch distribution data for merkle root:', error);
        }
      }
      
      // Validate proposal data
      const validation = validateProposalData(proposalData);
      if (!validation.isValid) {
        console.error('[API /verify] Validation failed:', validation.errors);
        
        // Include proposal snippet for debugging
        const bodySnippet = proposal.body.substring(0, 500) + (proposal.body.length > 500 ? '...' : '');
        
        return NextResponse.json(
          { 
            error: 'Invalid proposal data',
            details: validation.errors,
            warnings: validation.warnings,
            proposalTitle: proposal.title,
            proposalSnippet: bodySnippet,
            extractedData: proposalData,
            helpText: 'The proposal should contain a merkle root (0x followed by 64 hex characters) either in the proposal body or in the linked distribution data (IPFS, GitHub, or other URL)'
          },
          { status: 400 }
        );
      }

      if (!proposalData.merkleRoot) {
        return NextResponse.json(
          { error: 'No merkle root found in proposal' },
          { status: 400 }
        );
      }

      expectedRoot = proposalData.merkleRoot;

      // Get distribution URL
      const distributionUrl = getDistributionUrl(proposalData);
      
      if (!distributionUrl) {
        console.error('[API /verify] No distribution URL found');
        return NextResponse.json(
          { 
            error: 'No distribution data URL found in proposal',
            details: 'Could not find an IPFS, GitHub, or other URL containing the distribution data',
            extractedData: proposalData,
            proposalTitle: proposal.title
          },
          { status: 400 }
        );
      }
      
      console.log('[API /verify] Distribution URL:', distributionUrl);

      // Fetch distribution data (or use cached data if already fetched)
      console.log('[API /verify] Getting distribution data from:', distributionUrl);
      const ipfsManager = new IPFSGatewayManager();
      let distributionResponse;
      
      // Check if we already have cached distribution data from merkle root fetch
      if (proposalData.distributionData) {
        console.log('[API /verify] Using cached distribution data from previous fetch');
        distributionResponse = { data: proposalData.distributionData };
      } else {
        try {
          distributionResponse = await ipfsManager.fetch(distributionUrl);
          console.log('[API /verify] Distribution data fetched successfully');
        } catch (fetchError) {
          console.error('[API /verify] Failed to fetch distribution data:', fetchError);
          return NextResponse.json(
            { 
              error: 'Failed to fetch distribution data',
              details: {
                url: distributionUrl,
                error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
                suggestion: 'The IPFS content may be unavailable or in an unsupported format. Try providing the merkle root manually.'
              },
              proposalTitle: proposal.title,
              extractedData: proposalData
            },
            { status: 400 }
          );
        }
      }
      
      console.log('[API /verify] Distribution data fetched, parsing...');
      
      try {
        distribution = parseDistributionData(distributionResponse.data);
        console.log('[API /verify] Parsed distribution entries:', distribution.length);
      } catch (parseError) {
        console.error('[API /verify] Failed to parse distribution data:', parseError);
        
        // Try to provide helpful error message based on the data structure
        let dataPreview = '';
        if (typeof distributionResponse.data === 'string') {
          dataPreview = distributionResponse.data.substring(0, 200);
        } else if (distributionResponse.data) {
          dataPreview = JSON.stringify(distributionResponse.data, null, 2).substring(0, 500);
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to parse distribution data',
            details: {
              parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
              dataType: typeof distributionResponse.data,
              dataPreview,
              supportedFormats: [
                'Array of objects with address/amount fields',
                'Object with claims property (Uniswap style)',
                'Object with addresses as keys and amounts as values'
              ]
            },
            proposalTitle: proposal.title,
            helpText: 'The distribution data format is not recognized. Please check the data structure.'
          },
          { status: 400 }
        );
      }
    }

    // Create verification result
    const result = await createVerificationResult(
      distribution,
      expectedRoot,
      proposalId,
      spaceName
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API /verify] Verification error:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Verification failed';
    let errorDetails: any = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails.stack = error.stack;
      
      // Check for specific error types
      if (error.message.includes('fetch')) {
        errorDetails.type = 'network';
        errorDetails.helpText = 'Failed to fetch data. Check if the URL is accessible.';
      } else if (error.message.includes('GraphQL')) {
        errorDetails.type = 'graphql';
        errorDetails.helpText = 'Failed to query Snapshot GraphQL API. The proposal might not exist or the API might be down.';
      } else if (error.message.includes('parse')) {
        errorDetails.type = 'parsing';
        errorDetails.helpText = 'Failed to parse the data. The format might be unsupported.';
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Parses distribution data from various formats
 */
function parseDistributionData(data: any): DistributionData[] {
  console.log('[parseDistributionData] Data type:', typeof data);
  
  // Handle different distribution formats
  
  // Format 1: Array of objects with address and amount
  if (Array.isArray(data)) {
    console.log('[parseDistributionData] Processing array format, length:', data.length);
    
    // Check if it's a valid array of distribution entries
    if (data.length === 0) {
      throw new Error('Distribution data array is empty');
    }
    
    const result = data.map((item, index) => {
      // Try multiple field names for address and amount
      const address = item.address || item.recipient || item.account || item.wallet || item.to;
      const amount = item.amount || item.value || item.balance || item.quantity || item.tokens;
      
      if (!address) {
        throw new Error(`Missing address field in distribution entry ${index}. Available fields: ${Object.keys(item).join(', ')}`);
      }
      
      // Ensure amount is a valid string representation
      let amountStr = '0';
      if (amount !== undefined && amount !== null) {
        amountStr = String(amount);
        // Remove any decimals if present (amounts should be in wei)
        if (amountStr.includes('.')) {
          console.warn(`[parseDistributionData] Decimal amount detected at index ${index}: ${amountStr}`);
          // Just take the integer part for BigInt compatibility
          amountStr = amountStr.split('.')[0] || '0';
        }
        // Handle scientific notation
        if (amountStr.includes('e') || amountStr.includes('E')) {
          console.warn(`[parseDistributionData] Scientific notation detected at index ${index}: ${amountStr}`);
          // Try to parse it as a number and convert to string
          try {
            const numValue = Number(amountStr);
            amountStr = Math.floor(numValue).toString();
          } catch (e) {
            console.error(`[parseDistributionData] Failed to parse scientific notation: ${amountStr}`);
            amountStr = '0';
          }
        }
      }
      
      return {
        address,
        amount: amountStr,
        index: item.index !== undefined ? item.index : index
      };
    });
    
    console.log('[parseDistributionData] Successfully parsed array format, entries:', result.length);
    return result;
  }
  
  // Format 2: Object with claims property (Uniswap style)
  if (data.claims && typeof data.claims === 'object') {
    console.log('[parseDistributionData] Processing Uniswap-style claims format');
    return Object.entries(data.claims).map(([address, claim]: [string, any], idx) => ({
      address,
      amount: String(claim.amount || claim),
      index: claim.index !== undefined ? claim.index : idx
    }));
  }
  
  // Format 3: Object with recipients/distribution property
  if (data.recipients && typeof data.recipients === 'object') {
    console.log('[parseDistributionData] Processing recipients format');
    if (Array.isArray(data.recipients)) {
      return parseDistributionData(data.recipients);
    } else {
      return parseDistributionData(data.recipients);
    }
  }
  
  if (data.distribution && typeof data.distribution === 'object') {
    console.log('[parseDistributionData] Processing distribution format');
    if (Array.isArray(data.distribution)) {
      return parseDistributionData(data.distribution);
    } else {
      return parseDistributionData(data.distribution);
    }
  }
  
  // Format 4: Object with proofs array (oSnap/ParaSwap style)
  if (data.proofs && Array.isArray(data.proofs)) {
    console.log('[parseDistributionData] Processing proofs array format, length:', data.proofs.length);
    
    // Detect if this is ParaSwap rewards (has cumulativeClaimableAmount) or refunds
    const firstProof = data.proofs[0];
    const isParaSwapRewards = firstProof && firstProof.cumulativeClaimableAmount !== undefined;
    
    if (isParaSwapRewards) {
      console.log('[parseDistributionData] Detected ParaSwap rewards distribution (using cumulativeClaimableAmount)');
    } else {
      console.log('[parseDistributionData] Processing standard distribution (using amount field)');
    }
    
    const result = data.proofs.map((proof: any, index: number) => {
      // Try multiple field names for address
      const address = proof.user || proof.account || proof.address || proof.recipient;
      
      // For ParaSwap rewards, use cumulativeClaimableAmount; otherwise use amount
      let amount;
      if (isParaSwapRewards && proof.cumulativeClaimableAmount !== undefined) {
        amount = proof.cumulativeClaimableAmount;
      } else {
        // Try multiple field names for amount
        amount = proof.amount || proof.claimableAmount || proof.value || proof.balance;
      }
      
      if (!address) {
        throw new Error(`Missing address field in proof entry ${index}. Available fields: ${Object.keys(proof).join(', ')}`);
      }
      
      // Log first few entries to see what the data looks like
      if (index < 3) {
        console.log(`[parseDistributionData] Entry ${index}:`);
        console.log(`  - address: ${address}`);
        console.log(`  - amount used: ${amount}`);
        console.log(`  - cumulativeClaimableAmount: ${proof.cumulativeClaimableAmount}`);
        console.log(`  - claimableAmount: ${proof.claimableAmount}`);
        console.log(`  - amount field: ${proof.amount}`);
      }
      
      // Ensure amount is a valid string representation
      let amountStr = '0';
      if (amount !== undefined && amount !== null) {
        amountStr = String(amount);
        // Remove any decimals if present (amounts should be in wei)
        if (amountStr.includes('.')) {
          console.warn(`[parseDistributionData] Decimal amount detected at index ${index}: ${amountStr}`);
          // Just take the integer part for BigInt compatibility
          amountStr = amountStr.split('.')[0] || '0';
        }
        // Handle scientific notation
        if (amountStr.includes('e') || amountStr.includes('E')) {
          console.warn(`[parseDistributionData] Scientific notation detected at index ${index}: ${amountStr}`);
          // Try to parse it as a number and convert to string
          try {
            const numValue = Number(amountStr);
            amountStr = Math.floor(numValue).toString();
          } catch (e) {
            console.error(`[parseDistributionData] Failed to parse scientific notation: ${amountStr}`);
            amountStr = '0';
          }
        }
      } else {
        // Amount is missing
        if (index < 10) {
          console.warn(`[parseDistributionData] Missing amount at index ${index}, using default 0`);
        }
      }
      
      // Include additional fields for ParaSwap format detection
      const resultEntry: any = {
        address,
        amount: amountStr,
        index: proof.index !== undefined ? proof.index : index
      };
      
      // Preserve ParaSwap-specific fields for format detection
      if (proof.cumulativeClaimableAmount !== undefined) {
        resultEntry.cumulativeClaimableAmount = String(proof.cumulativeClaimableAmount);
      }
      if (proof.claimableAmount !== undefined) {
        resultEntry.claimableAmount = String(proof.claimableAmount);
      }
      if (proof.paraBoostScore !== undefined) {
        resultEntry.paraBoostScore = String(proof.paraBoostScore);
      }
      
      return resultEntry;
    });
    
    console.log('[parseDistributionData] Successfully parsed proofs format, entries:', result.length);
    return result;
  }
  
  // Format 5: Object with merkleRoot and other metadata
  if (data.merkleRoot && (data.recipients || data.claims || data.distribution || data.proofs)) {
    console.log('[parseDistributionData] Found merkleRoot with distribution data');
    // Try to find the actual distribution data
    const distData = data.recipients || data.claims || data.distribution || data.proofs;
    return parseDistributionData(distData);
  }
  
  // Format 6: Object with addresses as keys (simple key-value pairs)
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    
    // Check if this looks like an address-to-amount mapping
    // Ethereum addresses start with 0x and are 42 characters long
    const looksLikeAddresses = keys.length > 0 && 
      keys.filter(k => /^0x[a-fA-F0-9]{40}$/i.test(k)).length > keys.length * 0.5;
    
    if (looksLikeAddresses) {
      console.log('[parseDistributionData] Processing address-to-amount mapping');
      return Object.entries(data).map(([address, amount], index) => ({
        address,
        amount: String(amount),
        index
      }));
    }
    
    // If we have very few keys, it might be metadata
    if (keys.length < 5) {
      const availableKeys = keys.join(', ');
      throw new Error(`Object does not appear to contain distribution data. Available keys: ${availableKeys}`);
    }
  }
  
  throw new Error(`Unsupported distribution data format. Received type: ${typeof data}`);
}