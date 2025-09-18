import { parseUnits, formatUnits } from 'ethers';

export interface AmountValidation {
  isValid: boolean;
  amount?: bigint;
  formatted?: string;
  error?: string;
  warning?: string;
}

/**
 * Validates a token amount
 */
export function validateAmount(
  amount: string | number | bigint,
  decimals: number = 18
): AmountValidation {
  try {
    let amountBigInt: bigint;
    
    // Handle different input types
    if (typeof amount === 'bigint') {
      amountBigInt = amount;
    } else if (typeof amount === 'string') {
      // Check if it's already in wei (no decimals)
      if (/^\d+$/.test(amount)) {
        amountBigInt = BigInt(amount);
      } else {
        // Parse as decimal amount
        amountBigInt = parseUnits(amount, decimals);
      }
    } else if (typeof amount === 'number') {
      amountBigInt = parseUnits(amount.toString(), decimals);
    } else {
      return {
        isValid: false,
        error: 'Invalid amount type'
      };
    }
    
    // Check if amount is positive
    if (amountBigInt <= 0n) {
      return {
        isValid: false,
        amount: amountBigInt,
        error: 'Amount must be positive'
      };
    }
    
    // Check for suspiciously large amounts (potential overflow/error)
    const MAX_SUPPLY = parseUnits('1000000000000', decimals); // 1 trillion tokens
    if (amountBigInt > MAX_SUPPLY) {
      return {
        isValid: true,
        amount: amountBigInt,
        formatted: formatUnits(amountBigInt, decimals),
        warning: 'Amount is unusually large'
      };
    }
    
    return {
      isValid: true,
      amount: amountBigInt,
      formatted: formatUnits(amountBigInt, decimals)
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Amount validation failed'
    };
  }
}

/**
 * Validates a batch of amounts
 */
export function validateAmountBatch(
  amounts: Array<string | number | bigint>,
  decimals: number = 18
): {
  valid: bigint[];
  invalid: Array<{ amount: string; error: string }>;
  warnings: Array<{ amount: string; warning: string }>;
  statistics: AmountStatistics;
} {
  const valid: bigint[] = [];
  const invalid: Array<{ amount: string; error: string }> = [];
  const warnings: Array<{ amount: string; warning: string }> = [];
  
  amounts.forEach((amount, index) => {
    const validation = validateAmount(amount, decimals);
    
    if (!validation.isValid) {
      invalid.push({
        amount: amount.toString(),
        error: validation.error || 'Invalid amount'
      });
    } else if (validation.amount) {
      valid.push(validation.amount);
      
      if (validation.warning) {
        warnings.push({
          amount: amount.toString(),
          warning: validation.warning
        });
      }
    }
  });
  
  // Calculate statistics
  const statistics = calculateAmountStatistics(valid, decimals);
  
  return { valid, invalid, warnings, statistics };
}

export interface AmountStatistics {
  total: string;
  average: string;
  median: string;
  min: string;
  max: string;
  standardDeviation: string;
}

/**
 * Calculates statistics for a set of amounts
 */
export function calculateAmountStatistics(
  amounts: bigint[],
  decimals: number = 18
): AmountStatistics {
  if (amounts.length === 0) {
    return {
      total: '0',
      average: '0',
      median: '0',
      min: '0',
      max: '0',
      standardDeviation: '0'
    };
  }
  
  // Sort amounts for median calculation
  const sorted = [...amounts].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  
  // Calculate total
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  
  // Calculate average
  const average = total / BigInt(amounts.length);
  
  // Calculate median
  const median = amounts.length % 2 === 0
    ? (sorted[amounts.length / 2 - 1] + sorted[amounts.length / 2]) / 2n
    : sorted[Math.floor(amounts.length / 2)];
  
  // Find min and max
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  // Calculate standard deviation
  const variance = amounts.reduce((sum, amount) => {
    const diff = amount > average ? amount - average : average - amount;
    return sum + (diff * diff) / BigInt(amounts.length);
  }, 0n);
  
  // Approximate square root for standard deviation
  const stdDev = approximateSquareRoot(variance);
  
  return {
    total: formatUnits(total, decimals),
    average: formatUnits(average, decimals),
    median: formatUnits(median, decimals),
    min: formatUnits(min, decimals),
    max: formatUnits(max, decimals),
    standardDeviation: formatUnits(stdDev, decimals)
  };
}

/**
 * Approximates square root for bigint (Newton's method)
 */
function approximateSquareRoot(value: bigint): bigint {
  if (value < 0n) {
    throw new Error('Square root of negative number');
  }
  
  if (value === 0n) {
    return 0n;
  }
  
  let x = value;
  let y = (x + 1n) / 2n;
  
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  
  return x;
}

/**
 * Detects outliers in amounts using IQR method
 */
export function detectOutliers(amounts: bigint[]): {
  outliers: bigint[];
  lowerBound: bigint;
  upperBound: bigint;
} {
  if (amounts.length < 4) {
    return {
      outliers: [],
      lowerBound: 0n,
      upperBound: 0n
    };
  }
  
  const sorted = [...amounts].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
  
  // Calculate Q1 and Q3
  const q1Index = Math.floor(amounts.length * 0.25);
  const q3Index = Math.floor(amounts.length * 0.75);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Calculate bounds (1.5 * IQR)
  const lowerBound = q1 - (iqr * 3n) / 2n;
  const upperBound = q3 + (iqr * 3n) / 2n;
  
  // Find outliers
  const outliers = amounts.filter(amount => 
    amount < lowerBound || amount > upperBound
  );
  
  return {
    outliers,
    lowerBound: lowerBound < 0n ? 0n : lowerBound,
    upperBound
  };
}