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

      // Fetch distribution data
      console.log('[API /verify] Fetching distribution data from:', distributionUrl);
      const ipfsManager = new IPFSGatewayManager();
      const distributionResponse = await ipfsManager.fetch(distributionUrl);
      
      console.log('[API /verify] Distribution data fetched, parsing...');
      distribution = parseDistributionData(distributionResponse.data);
      console.log('[API /verify] Parsed distribution entries:', distribution.length);
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
  // Handle different distribution formats
  
  // Format 1: Array of objects with address and amount
  if (Array.isArray(data)) {
    return data.map((item, index) => ({
      address: item.address || item.recipient || item.account,
      amount: String(item.amount || item.value || item.balance),
      index
    }));
  }
  
  // Format 2: Object with claims property (Uniswap style)
  if (data.claims && typeof data.claims === 'object') {
    return Object.entries(data.claims).map(([address, claim]: [string, any]) => ({
      address,
      amount: String(claim.amount),
      index: claim.index || 0
    }));
  }
  
  // Format 3: Object with addresses as keys
  if (typeof data === 'object') {
    return Object.entries(data).map(([address, amount], index) => ({
      address,
      amount: String(amount),
      index
    }));
  }
  
  throw new Error('Unsupported distribution data format');
}