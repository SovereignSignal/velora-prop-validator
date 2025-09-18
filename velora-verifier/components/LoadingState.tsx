'use client';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        {/* Outer spinner */}
        <div className="w-20 h-20 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        
        {/* Inner spinner */}
        <div className="absolute inset-2 w-12 h-12 border-4 border-gray-700 border-t-purple-500 rounded-full animate-spin" 
             style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-white">Verifying Distribution</h3>
        <div className="space-y-1">
          <p className="text-sm text-gray-400 animate-pulse">Fetching proposal data...</p>
          <p className="text-sm text-gray-400 animate-pulse delay-100">Retrieving distribution from IPFS...</p>
          <p className="text-sm text-gray-400 animate-pulse delay-200">Computing merkle root...</p>
        </div>
      </div>
      
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}