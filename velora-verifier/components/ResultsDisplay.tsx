'use client';

import { VerificationResult } from '@/types/verification';

interface ResultsDisplayProps {
  result: VerificationResult;
  onReset: () => void;
}

export function ResultsDisplay({ result, onReset }: ResultsDisplayProps) {
  const isSuccess = result.success && result.merkleRoot.match;

  return (
    <div className="space-y-6">
      {/* Main Result */}
      <div className={`p-6 rounded-lg border-2 ${
        isSuccess 
          ? 'bg-green-900/20 border-green-500' 
          : 'bg-red-900/20 border-red-500'
      }`}>
        <div className="flex items-center justify-center mb-4">
          {isSuccess ? (
            <div className="text-green-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ) : (
            <div className="text-red-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </div>

        <h2 className={`text-2xl font-bold text-center mb-2 ${
          isSuccess ? 'text-green-400' : 'text-red-400'
        }`}>
          {isSuccess ? 'Verification Passed' : 'Verification Failed'}
        </h2>

        <p className="text-center text-gray-300">
          {isSuccess 
            ? 'The merkle root matches the distribution data'
            : 'The merkle root does not match the distribution data'}
        </p>
      </div>

      {/* Merkle Root Comparison */}
      <div className="bg-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-semibold text-white mb-3">Merkle Root Comparison</h3>
        
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-400 mb-1">Expected Root (from proposal)</p>
            <code className="block p-2 bg-gray-800 rounded text-xs text-gray-300 break-all">
              {result.merkleRoot.expected}
            </code>
          </div>
          
          <div>
            <p className="text-xs text-gray-400 mb-1">Computed Root (from distribution)</p>
            <code className="block p-2 bg-gray-800 rounded text-xs text-gray-300 break-all">
              {result.merkleRoot.computed}
            </code>
          </div>

          <div className={`text-sm font-medium ${
            result.merkleRoot.match ? 'text-green-400' : 'text-red-400'
          }`}>
            {result.merkleRoot.match ? '✓ Roots match' : '✗ Roots do not match'}
          </div>
        </div>
      </div>

      {/* Validation Checks */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Validation Checks</h3>
        
        <div className="space-y-2">
          {result.checks.map((check, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {check.status === 'passed' && (
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {check.status === 'failed' && (
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {check.status === 'warning' && (
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-200">{check.name}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    check.status === 'passed' 
                      ? 'bg-green-900/30 text-green-400'
                      : check.status === 'failed'
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {check.status}
                  </span>
                </div>
                {check.details && (
                  <p className="text-xs text-gray-400 mt-1">{check.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Distribution Details</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Recipients</p>
            <p className="text-lg font-medium text-white">{result.metadata.recipientCount.toLocaleString()}</p>
          </div>
          
          <div>
            <p className="text-xs text-gray-400">Total Amount</p>
            <p className="text-lg font-medium text-white">
              {result.metadata.totalAmount ? Number(result.metadata.totalAmount).toLocaleString() : 'N/A'}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-gray-400">Verification Time</p>
            <p className="text-lg font-medium text-white">{result.metadata.duration}ms</p>
          </div>
          
          <div>
            <p className="text-xs text-gray-400">Verified At</p>
            <p className="text-lg font-medium text-white">
              {new Date(result.metadata.verifiedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-400 mb-2">Warnings</h3>
          <ul className="space-y-1">
            {result.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-gray-300">
                • {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Errors</h3>
          <ul className="space-y-1">
            {result.errors.map((error, index) => (
              <li key={index} className="text-sm text-gray-300">
                • {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-4">
        <button
          onClick={onReset}
          className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          Verify Another Proposal
        </button>
        
        <button
          onClick={() => {
            // Export functionality would go here
            console.log('Export results:', result);
          }}
          className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Export Results
        </button>
      </div>
    </div>
  );
}