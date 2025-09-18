import { ethers, getAddress, isAddress } from 'ethers';

export interface AddressValidation {
  isValid: boolean;
  isContract?: boolean;
  hasChecksum: boolean;
  normalized?: string;
  error?: string;
}

/**
 * Validates an Ethereum address
 */
export function validateAddress(address: string): AddressValidation {
  try {
    // Check basic format
    if (!isAddress(address)) {
      return {
        isValid: false,
        hasChecksum: false,
        error: 'Invalid address format'
      };
    }

    // Check if address has valid checksum
    const hasChecksum = address !== address.toLowerCase() && address !== address.toUpperCase();
    
    // Get normalized (checksummed) address
    const normalized = getAddress(address.toLowerCase());

    return {
      isValid: true,
      hasChecksum,
      normalized
    };
  } catch (error) {
    return {
      isValid: false,
      hasChecksum: false,
      error: error instanceof Error ? error.message : 'Address validation failed'
    };
  }
}

/**
 * Detects if addresses are contracts using provider
 */
export async function detectContractAddresses(
  addresses: string[],
  provider: ethers.Provider
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  // Batch requests for efficiency
  const batchSize = 100;
  
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    
    const promises = batch.map(async (address) => {
      try {
        const code = await provider.getCode(address);
        // If code is not "0x", it's a contract
        return { address: address.toLowerCase(), isContract: code !== '0x' };
      } catch (error) {
        console.warn(`Failed to check contract status for ${address}:`, error);
        return { address: address.toLowerCase(), isContract: false };
      }
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ address, isContract }) => {
      results.set(address, isContract);
    });
  }
  
  return results;
}

/**
 * Finds duplicate addresses in a list
 */
export function findDuplicateAddresses(addresses: string[]): {
  duplicates: Map<string, number>;
  unique: string[];
} {
  const addressCounts = new Map<string, number>();
  const unique = new Set<string>();
  
  addresses.forEach(address => {
    const normalized = address.toLowerCase();
    addressCounts.set(normalized, (addressCounts.get(normalized) || 0) + 1);
    unique.add(normalized);
  });
  
  // Filter to only duplicates (count > 1)
  const duplicates = new Map<string, number>();
  addressCounts.forEach((count, address) => {
    if (count > 1) {
      duplicates.set(address, count);
    }
  });
  
  return {
    duplicates,
    unique: Array.from(unique)
  };
}

/**
 * Validates a batch of addresses
 */
export function validateAddressBatch(addresses: string[]): {
  valid: string[];
  invalid: Array<{ address: string; error: string }>;
  warnings: Array<{ address: string; warning: string }>;
} {
  const valid: string[] = [];
  const invalid: Array<{ address: string; error: string }> = [];
  const warnings: Array<{ address: string; warning: string }> = [];
  
  addresses.forEach(address => {
    const validation = validateAddress(address);
    
    if (!validation.isValid) {
      invalid.push({
        address,
        error: validation.error || 'Invalid address'
      });
    } else {
      if (validation.normalized) {
        valid.push(validation.normalized);
      }
      
      if (!validation.hasChecksum) {
        warnings.push({
          address,
          warning: 'Address does not have valid checksum'
        });
      }
    }
  });
  
  return { valid, invalid, warnings };
}

/**
 * Checks if an address is a known problematic contract
 * (e.g., contracts that can't receive tokens)
 */
export function isProblematicContract(address: string): {
  isProblematic: boolean;
  reason?: string;
} {
  const normalized = address.toLowerCase();
  
  // Known problematic addresses
  const problematic: Record<string, string> = {
    '0x0000000000000000000000000000000000000000': 'Null address',
    '0x000000000000000000000000000000000000dead': 'Burn address',
    '0x0000000000000000000000000000000000000001': 'Precompiled contract',
    '0x0000000000000000000000000000000000000002': 'Precompiled contract',
    '0x0000000000000000000000000000000000000003': 'Precompiled contract',
    '0x0000000000000000000000000000000000000004': 'Precompiled contract',
    '0x0000000000000000000000000000000000000005': 'Precompiled contract',
    '0x0000000000000000000000000000000000000006': 'Precompiled contract',
    '0x0000000000000000000000000000000000000007': 'Precompiled contract',
    '0x0000000000000000000000000000000000000008': 'Precompiled contract',
    '0x0000000000000000000000000000000000000009': 'Precompiled contract',
  };
  
  if (problematic[normalized]) {
    return {
      isProblematic: true,
      reason: problematic[normalized]
    };
  }
  
  return { isProblematic: false };
}