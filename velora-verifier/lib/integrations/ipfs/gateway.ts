import { IPFSGateway, IPFSResponse } from '@/types/ipfs';
import { IPFSError } from '@/types/errors';

export class IPFSGatewayManager {
  private gateways: IPFSGateway[] = [
    { url: 'https://ipfs.io/ipfs/', priority: 1, timeout: 10000 },
    { url: 'https://cloudflare-ipfs.com/ipfs/', priority: 2, timeout: 8000 },
    { url: 'https://gateway.pinata.cloud/ipfs/', priority: 3, timeout: 10000 },
    { url: 'https://dweb.link/ipfs/', priority: 4, timeout: 10000 },
    { url: 'https://w3s.link/ipfs/', priority: 5, timeout: 10000 },
    { url: 'https://ipfs.infura.io/ipfs/', priority: 6, timeout: 10000 },
    { url: 'https://gateway.ipfs.io/ipfs/', priority: 7, timeout: 10000 }
  ];
  
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  
  constructor(customGateways?: IPFSGateway[]) {
    if (customGateways) {
      this.gateways = customGateways;
    }
    
    // Sort gateways by priority
    this.gateways.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Fetches content from IPFS with automatic fallback
   */
  async fetch(cidOrUrl: string): Promise<IPFSResponse> {
    const cid = this.extractCID(cidOrUrl);
    
    if (!cid) {
      throw new IPFSError('Invalid IPFS CID or URL', undefined, cidOrUrl);
    }
    
    // Check cache
    const cached = this.getFromCache(cid);
    if (cached) {
      console.log(`[IPFS] Cache hit for ${cid}`);
      return {
        data: cached,
        gateway: 'cache',
        cid,
        retrievedAt: new Date().toISOString(),
        attempts: 0
      };
    }
    
    // Try each gateway with exponential backoff
    const errors: Array<{ gateway: string; error: string }> = [];
    let attempts = 0;
    
    for (const [index, gateway] of this.gateways.entries()) {
      attempts++;
      
      try {
        console.log(`[IPFS] Attempting gateway ${index + 1}/${this.gateways.length}: ${gateway.url}`);
        
        // Add delay between attempts (exponential backoff)
        if (index > 0) {
          const delay = Math.min(1000 * Math.pow(2, index - 1), 5000);
          await this.delay(delay);
        }
        
        const data = await this.fetchFromGateway(gateway, cid);
        
        // Cache successful response
        this.addToCache(cid, data);
        
        return {
          data,
          gateway: gateway.url,
          cid,
          retrievedAt: new Date().toISOString(),
          attempts
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[IPFS] Gateway ${gateway.url} failed: ${errorMessage}`);
        errors.push({ gateway: gateway.url, error: errorMessage });
        
        // Continue to next gateway
        continue;
      }
    }
    
    // All gateways failed
    throw new IPFSError(
      `Failed to fetch from all ${this.gateways.length} IPFS gateways. Errors: ${JSON.stringify(errors)}`,
      undefined,
      cid
    );
  }
  
  /**
   * Fetches from a specific gateway
   */
  private async fetchFromGateway(gateway: IPFSGateway, cid: string): Promise<any> {
    const url = `${gateway.url}${cid}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), gateway.timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        // Try to parse as JSON anyway (some gateways don't set correct content-type)
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          // Return as plain text if JSON parsing fails
          return text;
        }
      }
    } catch (error) {
      clearTimeout(timeout);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Gateway timeout after ${gateway.timeout}ms`);
      }
      
      throw error;
    }
  }
  
  /**
   * Extracts CID from various IPFS URL formats
   */
  private extractCID(input: string): string | null {
    // Already a CID
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(input)) {
      return input;
    }
    
    // CIDv1
    if (/^[a-z0-9]{46,}$/.test(input)) {
      return input;
    }
    
    // IPFS URLs
    const patterns = [
      /ipfs[:/]+(Qm[1-9A-HJ-NP-Za-km-z]{44})/,
      /ipfs[:/]+([a-z0-9]{46,})/,
      /\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44})/,
      /\/ipfs\/([a-z0-9]{46,})/
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Adds data to cache
   */
  private addToCache(cid: string, data: any): void {
    this.cache.set(cid, {
      data,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    this.cleanCache();
  }
  
  /**
   * Gets data from cache if not expired
   */
  private getFromCache(cid: string): any | null {
    const cached = this.cache.get(cid);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cid);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Removes expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    
    for (const [cid, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(cid);
      }
    }
  }
  
  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}