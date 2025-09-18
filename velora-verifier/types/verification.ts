export interface VerificationResult {
  success: boolean;
  merkleRoot: {
    expected: string;
    computed: string;
    match: boolean;
  };
  checks: ValidationCheck[];
  statistics?: DistributionStatistics;
  errors: VerificationError[];
  warnings: VerificationWarning[];
  metadata: {
    proposalId?: string;
    spaceName?: string;
    recipientCount: number;
    totalAmount: string;
    verifiedAt: string;
    duration: number;
  };
}

export interface ValidationCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  description: string;
  details?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface VerificationError {
  code: string;
  message: string;
  details?: any;
}

export interface VerificationWarning {
  code: string;
  message: string;
  details?: any;
}

export interface DistributionStatistics {
  recipientCount: number;
  totalAmount: string;
  averageAmount: string;
  medianAmount: string;
  minAmount: string;
  maxAmount: string;
  giniCoefficient: number;
  concentrationRisk: 'low' | 'medium' | 'high';
  uniqueRecipients: number;
  duplicateRecipients: number;
  contractAddresses: number;
  eoaAddresses: number;
}