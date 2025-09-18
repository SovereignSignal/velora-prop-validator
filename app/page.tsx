'use client';

import { useState } from 'react';
import { VerificationForm } from '@/components/VerificationForm';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { AdvancedOptions } from '@/components/AdvancedOptions';
import { LoadingState } from '@/components/LoadingState';
import { VerificationResult } from '@/types/verification';

export default function Home() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleVerify = async (url: string, options?: any) => {
    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...options })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Velora Verification System
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Instantly verify DAO token distributions before voting. 
            Protect treasury funds with merkle root verification.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 mb-8 border border-gray-700">
          {!result && !isVerifying && (
            <>
              <VerificationForm onVerify={handleVerify} disabled={isVerifying} />
              
              {/* Advanced Options Toggle */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showAdvanced ? '− Hide' : '+ Show'} Advanced Options
                </button>
              </div>
              
              {showAdvanced && (
                <div className="mt-6">
                  <AdvancedOptions onVerify={handleVerify} />
                </div>
              )}
            </>
          )}

          {isVerifying && <LoadingState />}

          {result && (
            <ResultsDisplay 
              result={result} 
              onReset={handleReset}
            />
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
              <div className="text-red-400 mb-2">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-red-400 mb-2">Verification Error</h3>
              <p className="text-gray-300">{error}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-green-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Instant Verification</h3>
            <p className="text-gray-400 text-sm">
              Get results in seconds, not minutes. Optimized for distributions up to 100,000 recipients.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-blue-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Multiple Formats</h3>
            <p className="text-gray-400 text-sm">
              Supports OpenZeppelin, Uniswap, and custom merkle tree formats used by major DAOs.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-purple-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Detailed Analysis</h3>
            <p className="text-gray-400 text-sm">
              Get comprehensive statistics, concentration analysis, and anomaly detection.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Verify distributions • Protect treasury funds • Build trust in governance</p>
        </div>
      </div>
    </main>
  );
}
