'use client';

import { useState } from 'react';

interface VerificationFormProps {
  onVerify: (url: string) => void;
  disabled?: boolean;
}

export function VerificationForm({ onVerify, disabled }: VerificationFormProps) {
  const [url, setUrl] = useState('');
  const [isValid, setIsValid] = useState(true);

  const validateUrl = (value: string) => {
    // Basic validation for Snapshot URLs
    const isSnapshotUrl = value.includes('snapshot.org') || 
                         value.includes('snapshot.page') ||
                         value.includes('snapshot.box');
    const isProposalUrl = value.includes('/proposal/');
    
    return isSnapshotUrl && isProposalUrl;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setIsValid(false);
      return;
    }

    if (!validateUrl(url)) {
      setIsValid(false);
      return;
    }

    onVerify(url);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    
    if (!isValid) {
      setIsValid(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-2">
          Snapshot Proposal URL
        </label>
        <div className="relative">
          <input
            id="url"
            type="text"
            value={url}
            onChange={handleChange}
            disabled={disabled}
            placeholder="https://snapshot.org/#/space.eth/proposal/0x..."
            className={`
              w-full px-4 py-3 rounded-lg
              bg-gray-700 border
              ${!isValid ? 'border-red-500' : 'border-gray-600'}
              text-white placeholder-gray-400
              focus:outline-none focus:ring-2
              ${!isValid ? 'focus:ring-red-500' : 'focus:ring-blue-500'}
              focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            `}
          />
          {url && validateUrl(url) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        {!isValid && (
          <p className="mt-2 text-sm text-red-400">
            Please enter a valid Snapshot proposal URL
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !url}
        className={`
          w-full py-3 px-6 rounded-lg font-semibold
          transition-all duration-200
          ${disabled || !url
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
        `}
      >
        Verify Distribution
      </button>

      <div className="text-center text-sm text-gray-400">
        <p>Paste a Snapshot proposal URL to verify its merkle root</p>
      </div>
    </form>
  );
}