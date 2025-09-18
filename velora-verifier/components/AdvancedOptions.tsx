'use client';

import { useState } from 'react';

interface AdvancedOptionsProps {
  onVerify: (url: string, options: any) => void;
}

export function AdvancedOptions({ onVerify }: AdvancedOptionsProps) {
  const [ipfsHash, setIpfsHash] = useState('');
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [merkleFormat, setMerkleFormat] = useState<'auto' | 'openzeppelin' | 'uniswap' | 'custom'>('auto');
  const [customRoot, setCustomRoot] = useState('');

  const handleIpfsVerify = () => {
    if (!ipfsHash || !customRoot) return;
    
    onVerify('manual', {
      type: 'ipfs',
      ipfsHash,
      merkleRoot: customRoot,
      format: merkleFormat
    });
  };

  const handleFileVerify = () => {
    if (!jsonFile || !customRoot) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        onVerify('manual', {
          type: 'file',
          data: JSON.parse(content),
          merkleRoot: customRoot,
          format: merkleFormat
        });
      }
    };
    reader.readAsText(jsonFile);
  };

  return (
    <div className="space-y-6 p-6 bg-gray-700/50 rounded-lg">
      <h3 className="text-lg font-semibold text-white">Advanced Options</h3>
      
      {/* Format Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Merkle Tree Format
        </label>
        <select
          value={merkleFormat}
          onChange={(e) => setMerkleFormat(e.target.value as any)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="auto">Auto-detect</option>
          <option value="openzeppelin">OpenZeppelin</option>
          <option value="uniswap">Uniswap</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Manual IPFS */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-300">Manual IPFS Verification</h4>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            IPFS Hash / CID
          </label>
          <input
            type="text"
            value={ipfsHash}
            onChange={(e) => setIpfsHash(e.target.value)}
            placeholder="QmXxx... or bafy..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Expected Merkle Root
          </label>
          <input
            type="text"
            value={customRoot}
            onChange={(e) => setCustomRoot(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleIpfsVerify}
          disabled={!ipfsHash || !customRoot}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            !ipfsHash || !customRoot
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          Verify from IPFS
        </button>
      </div>

      {/* File Upload */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-300">Local File Verification</h4>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Distribution JSON File
          </label>
          <input
            type="file"
            accept=".json"
            onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-600 file:text-white hover:file:bg-gray-500"
          />
        </div>

        <button
          onClick={handleFileVerify}
          disabled={!jsonFile || !customRoot}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            !jsonFile || !customRoot
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          Verify from File
        </button>
      </div>
    </div>
  );
}