import { DistributionData } from '@/types/distribution';
import { VerificationResult, ValidationCheck } from '@/types/verification';
import { generateMerkleTree, detectMerkleFormat, MerkleFormat } from './generator';

/**
 * Verifies a distribution's merkle root against the expected root
 */
export async function verifyMerkleRoot(
  distribution: DistributionData[],
  expectedRoot: string,
  format?: MerkleFormat
): Promise<{
  success: boolean;
  computedRoot: string;
  format: MerkleFormat;
  details?: string;
}> {
  // Auto-detect format if not provided
  let detectedFormat = format;
  
  if (!detectedFormat) {
    detectedFormat = detectMerkleFormat(distribution, expectedRoot) || 'custom';
    console.log(`Auto-detected merkle format: ${detectedFormat}`);
  }

  // Generate merkle tree
  const merkleData = generateMerkleTree(distribution, detectedFormat);
  const computedRoot = merkleData.root;

  // Compare roots (case-insensitive)
  const success = computedRoot.toLowerCase() === expectedRoot.toLowerCase();

  return {
    success,
    computedRoot,
    format: detectedFormat,
    details: success 
      ? `Merkle root verified successfully using ${detectedFormat} format`
      : `Merkle root mismatch. Expected: ${expectedRoot}, Computed: ${computedRoot}`
  };
}

/**
 * Performs comprehensive validation checks on a distribution
 */
export function validateDistribution(distribution: DistributionData[]): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Check 1: Distribution is not empty
  checks.push({
    name: 'Distribution Not Empty',
    status: distribution.length > 0 ? 'passed' : 'failed',
    description: 'Verify distribution contains recipients',
    details: `Found ${distribution.length} recipients`,
    severity: 'critical'
  });

  // Check 2: All addresses are valid
  const invalidAddresses = distribution.filter(d => !isValidAddress(d.address));
  checks.push({
    name: 'Address Validation',
    status: invalidAddresses.length === 0 ? 'passed' : 'failed',
    description: 'All addresses must be valid Ethereum addresses',
    details: invalidAddresses.length > 0 
      ? `Found ${invalidAddresses.length} invalid addresses`
      : 'All addresses are valid',
    severity: 'critical'
  });

  // Check 3: All amounts are positive
  const invalidAmounts = distribution.filter((d, index) => {
    try {
      // Handle different amount formats
      if (!d.amount && d.amount !== 0 && d.amount !== '0') {
        console.warn(`[validateDistribution] Missing amount at index ${index}`);
        return true; // Missing amount
      }
      
      const amountStr = String(d.amount);
      
      // Check for decimal points (not allowed in BigInt)
      if (amountStr.includes('.') || amountStr.includes('e') || amountStr.includes('E')) {
        console.warn(`[validateDistribution] Invalid amount format for BigInt at index ${index}: ${amountStr}`);
        return true; // Invalid format for BigInt
      }
      
      const amount = BigInt(amountStr);
      const isInvalid = amount < 0n;  // Allow zero amounts, only negative is invalid
      if (isInvalid && index < 5) {
        console.warn(`[validateDistribution] Amount is negative at index ${index}: ${amount.toString()}`);
      }
      return isInvalid;
    } catch (error) {
      console.error(`[validateDistribution] Failed to parse amount at index ${index}: ${d.amount}`, error);
      return true; // Invalid amount that couldn't be converted
    }
  });
  checks.push({
    name: 'Amount Validation',
    status: invalidAmounts.length === 0 ? 'passed' : 'failed',
    description: 'All amounts must be non-negative',
    details: invalidAmounts.length > 0
      ? `Found ${invalidAmounts.length} invalid amounts`
      : 'All amounts are valid',
    severity: 'critical'
  });

  // Check 4: Check for duplicates
  const addressCounts = new Map<string, number>();
  distribution.forEach(d => {
    const addr = d.address.toLowerCase();
    addressCounts.set(addr, (addressCounts.get(addr) || 0) + 1);
  });
  const duplicates = Array.from(addressCounts.entries()).filter(([_, count]) => count > 1);
  
  checks.push({
    name: 'Duplicate Check',
    status: duplicates.length === 0 ? 'passed' : 'warning',
    description: 'Check for duplicate recipient addresses',
    details: duplicates.length > 0
      ? `Found ${duplicates.length} duplicate addresses with ${duplicates.reduce((sum, [_, count]) => sum + count - 1, 0)} duplicate entries`
      : 'No duplicate addresses found',
    severity: duplicates.length > 0 ? 'medium' : 'low'
  });

  // Check 5: Total amount is reasonable
  const totalAmount = distribution.reduce((sum, d) => {
    try {
      const amountStr = String(d.amount || '0');
      // Skip invalid amounts
      if (amountStr.includes('.') || amountStr.includes('e') || amountStr.includes('E')) {
        return sum;
      }
      return sum + BigInt(amountStr);
    } catch (error) {
      console.warn(`[validateDistribution] Skipping invalid amount in total calculation: ${d.amount}`);
      return sum;
    }
  }, 0n);
  const avgAmount = distribution.length > 0 ? totalAmount / BigInt(distribution.length) : 0n;
  
  checks.push({
    name: 'Total Distribution',
    status: 'passed',
    description: 'Total and average distribution amounts',
    details: `Total: ${totalAmount.toString()}, Average: ${avgAmount.toString()}`,
    severity: 'low'
  });

  return checks;
}

/**
 * Validates an Ethereum address
 */
function isValidAddress(address: string): boolean {
  // Check if it's a valid hex string of correct length
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Creates a comprehensive verification result
 */
export async function createVerificationResult(
  distribution: DistributionData[],
  expectedRoot: string,
  proposalId?: string,
  spaceName?: string
): Promise<VerificationResult> {
  const startTime = Date.now();

  // Verify merkle root
  const merkleVerification = await verifyMerkleRoot(distribution, expectedRoot);
  
  // Run validation checks
  const checks = validateDistribution(distribution);
  
  // Calculate basic statistics
  const totalAmount = distribution.reduce((sum, d) => {
    try {
      const amountStr = String(d.amount || '0');
      // Skip invalid amounts
      if (amountStr.includes('.') || amountStr.includes('e') || amountStr.includes('E')) {
        return sum;
      }
      return sum + BigInt(amountStr);
    } catch (error) {
      console.warn(`[createVerificationResult] Skipping invalid amount: ${d.amount}`);
      return sum;
    }
  }, 0n);
  const uniqueAddresses = new Set(distribution.map(d => d.address.toLowerCase())).size;

  const result: VerificationResult = {
    success: merkleVerification.success && checks.every(c => c.status !== 'failed'),
    merkleRoot: {
      expected: expectedRoot,
      computed: merkleVerification.computedRoot,
      match: merkleVerification.success
    },
    checks,
    errors: merkleVerification.success ? [] : [{
      code: 'MERKLE_ROOT_MISMATCH',
      message: merkleVerification.details || 'Merkle root verification failed'
    }],
    warnings: checks
      .filter(c => c.status === 'warning')
      .map(c => ({
        code: c.name.toUpperCase().replace(/\s+/g, '_'),
        message: c.details || c.description
      })),
    metadata: {
      proposalId,
      spaceName,
      recipientCount: distribution.length,
      totalAmount: totalAmount.toString(),
      verifiedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    }
  };

  return result;
}