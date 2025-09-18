import { DistributionData } from '@/types/distribution';
import { ValidationCheck, DistributionStatistics } from '@/types/verification';
import { validateAddressBatch, findDuplicateAddresses, isProblematicContract } from './address';
import { validateAmountBatch, detectOutliers, calculateAmountStatistics } from './amounts';

export interface DistributionValidationResult {
  checks: ValidationCheck[];
  statistics: DistributionStatistics;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive distribution validation
 */
export async function validateDistribution(
  distribution: DistributionData[],
  options: {
    checkContracts?: boolean;
    provider?: any; // ethers.Provider
    decimals?: number;
  } = {}
): Promise<DistributionValidationResult> {
  const checks: ValidationCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Extract addresses and amounts
  const addresses = distribution.map(d => d.address);
  const amounts = distribution.map(d => d.amount);
  
  // 1. Check distribution is not empty
  if (distribution.length === 0) {
    errors.push('Distribution is empty');
    checks.push({
      name: 'Distribution Size',
      status: 'failed',
      description: 'Distribution must contain at least one recipient',
      severity: 'critical'
    });
    
    return {
      checks,
      statistics: createEmptyStatistics(),
      errors,
      warnings
    };
  }
  
  checks.push({
    name: 'Distribution Size',
    status: 'passed',
    description: 'Distribution contains recipients',
    details: `${distribution.length} recipients`,
    severity: 'low'
  });
  
  // 2. Validate addresses
  const addressValidation = validateAddressBatch(addresses);
  
  if (addressValidation.invalid.length > 0) {
    errors.push(`${addressValidation.invalid.length} invalid addresses found`);
    addressValidation.invalid.forEach(({ address, error }) => {
      errors.push(`Address ${address}: ${error}`);
    });
    
    checks.push({
      name: 'Address Format',
      status: 'failed',
      description: 'All addresses must be valid Ethereum addresses',
      details: `${addressValidation.invalid.length} invalid addresses`,
      severity: 'critical'
    });
  } else {
    checks.push({
      name: 'Address Format',
      status: 'passed',
      description: 'All addresses are valid',
      details: `${addressValidation.valid.length} valid addresses`,
      severity: 'low'
    });
  }
  
  if (addressValidation.warnings.length > 0) {
    addressValidation.warnings.forEach(({ warning }) => {
      warnings.push(warning);
    });
  }
  
  // 3. Check for duplicate addresses
  const { duplicates, unique } = findDuplicateAddresses(addresses);
  
  if (duplicates.size > 0) {
    warnings.push(`${duplicates.size} duplicate addresses found`);
    
    let totalDuplicateEntries = 0;
    duplicates.forEach((count) => {
      totalDuplicateEntries += count - 1;
    });
    
    checks.push({
      name: 'Duplicate Recipients',
      status: 'warning',
      description: 'Distribution contains duplicate addresses',
      details: `${duplicates.size} addresses appear multiple times (${totalDuplicateEntries} duplicate entries)`,
      severity: 'medium'
    });
  } else {
    checks.push({
      name: 'Duplicate Recipients',
      status: 'passed',
      description: 'No duplicate addresses found',
      severity: 'low'
    });
  }
  
  // 4. Check for problematic addresses
  const problematicAddresses = addresses.filter(addr => 
    isProblematicContract(addr).isProblematic
  );
  
  if (problematicAddresses.length > 0) {
    warnings.push(`${problematicAddresses.length} problematic addresses detected`);
    
    checks.push({
      name: 'Problematic Addresses',
      status: 'warning',
      description: 'Distribution contains known problematic addresses',
      details: `${problematicAddresses.length} addresses may not be able to receive tokens`,
      severity: 'high'
    });
  } else {
    checks.push({
      name: 'Problematic Addresses',
      status: 'passed',
      description: 'No known problematic addresses found',
      severity: 'low'
    });
  }
  
  // 5. Validate amounts
  const amountValidation = validateAmountBatch(amounts, options.decimals || 18);
  
  if (amountValidation.invalid.length > 0) {
    errors.push(`${amountValidation.invalid.length} invalid amounts found`);
    
    checks.push({
      name: 'Amount Validation',
      status: 'failed',
      description: 'All amounts must be positive numbers',
      details: `${amountValidation.invalid.length} invalid amounts`,
      severity: 'critical'
    });
  } else {
    checks.push({
      name: 'Amount Validation',
      status: 'passed',
      description: 'All amounts are valid',
      details: `${amountValidation.valid.length} valid amounts`,
      severity: 'low'
    });
  }
  
  if (amountValidation.warnings.length > 0) {
    amountValidation.warnings.forEach(({ warning }) => {
      warnings.push(warning);
    });
  }
  
  // 6. Check for outliers
  const outlierDetection = detectOutliers(amountValidation.valid);
  
  if (outlierDetection.outliers.length > 0) {
    warnings.push(`${outlierDetection.outliers.length} outlier amounts detected`);
    
    checks.push({
      name: 'Amount Outliers',
      status: 'warning',
      description: 'Distribution contains outlier amounts',
      details: `${outlierDetection.outliers.length} amounts are statistical outliers`,
      severity: 'medium'
    });
  } else {
    checks.push({
      name: 'Amount Outliers',
      status: 'passed',
      description: 'No significant outliers detected',
      severity: 'low'
    });
  }
  
  // 7. Calculate concentration risk
  const concentrationRisk = calculateConcentrationRisk(amountValidation.valid);
  
  checks.push({
    name: 'Concentration Risk',
    status: concentrationRisk === 'high' ? 'warning' : 'passed',
    description: 'Distribution concentration analysis',
    details: `Concentration risk: ${concentrationRisk}`,
    severity: concentrationRisk === 'high' ? 'medium' : 'low'
  });
  
  // Calculate statistics
  const statistics: DistributionStatistics = {
    recipientCount: distribution.length,
    totalAmount: amountValidation.statistics.total,
    averageAmount: amountValidation.statistics.average,
    medianAmount: amountValidation.statistics.median,
    minAmount: amountValidation.statistics.min,
    maxAmount: amountValidation.statistics.max,
    giniCoefficient: calculateGiniCoefficient(amountValidation.valid),
    concentrationRisk,
    uniqueRecipients: unique.length,
    duplicateRecipients: duplicates.size,
    contractAddresses: 0, // Will be updated if contract check is enabled
    eoaAddresses: 0 // Will be updated if contract check is enabled
  };
  
  return {
    checks,
    statistics,
    errors,
    warnings
  };
}

/**
 * Calculates the Gini coefficient for distribution inequality
 */
function calculateGiniCoefficient(amounts: bigint[]): number {
  if (amounts.length === 0) return 0;
  if (amounts.length === 1) return 0;
  
  // Sort amounts
  const sorted = [...amounts].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  
  const n = sorted.length;
  let cumulativeTotal = 0n;
  let weightedSum = 0n;
  
  for (let i = 0; i < n; i++) {
    cumulativeTotal += sorted[i];
    weightedSum += sorted[i] * BigInt(i + 1);
  }
  
  if (cumulativeTotal === 0n) return 0;
  
  // Gini = (2 * weightedSum) / (n * cumulativeTotal) - (n + 1) / n
  const gini = Number((2n * weightedSum * 10000n) / (BigInt(n) * cumulativeTotal)) / 10000 
    - (n + 1) / n;
  
  return Math.max(0, Math.min(1, gini));
}

/**
 * Calculates concentration risk based on distribution
 */
function calculateConcentrationRisk(amounts: bigint[]): 'low' | 'medium' | 'high' {
  if (amounts.length === 0) return 'low';
  
  // Sort amounts in descending order
  const sorted = [...amounts].sort((a, b) => {
    if (a > b) return -1;
    if (a < b) return 1;
    return 0;
  });
  
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  if (total === 0n) return 'low';
  
  // Calculate how much the top 10% of recipients get
  const top10PercentCount = Math.max(1, Math.floor(sorted.length * 0.1));
  let top10PercentTotal = 0n;
  
  for (let i = 0; i < top10PercentCount; i++) {
    top10PercentTotal += sorted[i];
  }
  
  const top10PercentShare = Number((top10PercentTotal * 100n) / total);
  
  // Risk thresholds
  if (top10PercentShare > 80) return 'high';
  if (top10PercentShare > 50) return 'medium';
  return 'low';
}

/**
 * Creates empty statistics object
 */
function createEmptyStatistics(): DistributionStatistics {
  return {
    recipientCount: 0,
    totalAmount: '0',
    averageAmount: '0',
    medianAmount: '0',
    minAmount: '0',
    maxAmount: '0',
    giniCoefficient: 0,
    concentrationRisk: 'low',
    uniqueRecipients: 0,
    duplicateRecipients: 0,
    contractAddresses: 0,
    eoaAddresses: 0
  };
}