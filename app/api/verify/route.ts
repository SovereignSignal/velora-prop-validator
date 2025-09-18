import { NextRequest, NextResponse } from 'next/server';
import { SnapshotClient } from '@/lib/integrations/snapshot/client';
import { parseProposal, getDistributionUrl, validateProposalData } from '@/lib/integrations/snapshot/parser';
import { IPFSGatewayManager } from '@/lib/integrations/ipfs/gateway';
import { createVerificationResult } from '@/lib/merkle/verifier';
import { DistributionData } from '@/types/distribution';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, type, ipfsHash, data, merkleRoot, format } = body;

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
          { error: 'Invalid Snapshot URL format' },
          { status: 400 }
        );
      }
      
      proposalId = extractedProposalId;
      spaceName = extractedSpaceName || undefined;

      // Fetch proposal from Snapshot
      const snapshotClient = new SnapshotClient();
      const proposal = await snapshotClient.getProposal(proposalId);

      // Parse proposal to extract merkle root and distribution URL
      const proposalData = parseProposal(proposal);
      
      // Validate proposal data
      const validation = validateProposalData(proposalData);
      if (!validation.isValid) {
        return NextResponse.json(
          { 
            error: 'Invalid proposal data',
            details: validation.errors 
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
        return NextResponse.json(
          { error: 'No distribution data URL found in proposal' },
          { status: 400 }
        );
      }

      // Fetch distribution data
      const ipfsManager = new IPFSGatewayManager();
      const distributionResponse = await ipfsManager.fetch(distributionUrl);
      distribution = parseDistributionData(distributionResponse.data);
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
    console.error('Verification error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Verification failed',
        details: error instanceof Error ? error.stack : undefined
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