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
      } else if (contentType?.includes('text/html')) {
        // Check if this is an IPFS directory listing
        const htmlText = await response.text();
        if (this.isIPFSDirectoryListing(htmlText)) {
          console.log(`[IPFS] Detected directory listing for ${cid}, attempting to fetch JSON files`);
          return await this.fetchFromIPFSDirectory(gateway, cid, htmlText);
        }
        // Try to parse as JSON anyway
        try {
          return JSON.parse(htmlText);
        } catch {
          return htmlText;
        }
      } else {
        // Try to parse as JSON anyway (some gateways don't set correct content-type)
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          // Check if it might be HTML directory listing without proper content-type
          if (this.isIPFSDirectoryListing(text)) {
            console.log(`[IPFS] Detected directory listing (no content-type) for ${cid}`);
            return await this.fetchFromIPFSDirectory(gateway, cid, text);
          }
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
   * Checks if the content is an IPFS directory listing
   */
  private isIPFSDirectoryListing(content: string): boolean {
    // Check for common patterns in IPFS directory HTML listings
    return content.includes('Index of') || 
           content.includes('/ipfs/') && content.includes('<a href=') ||
           content.includes('ipfs-') && content.includes('<!DOCTYPE html>');
  }
  
  /**
   * Fetches JSON content from an IPFS directory
   */
  private async fetchFromIPFSDirectory(gateway: IPFSGateway, dirCid: string, htmlContent: string): Promise<any> {
    // Parse HTML to find JSON files
    const jsonFiles = this.extractJSONFilesFromHTML(htmlContent);
    
    if (jsonFiles.length === 0) {
      console.log('[IPFS] No JSON files found in directory listing');
      throw new Error('IPFS directory does not contain any JSON files');
    }
    
    console.log(`[IPFS] Found ${jsonFiles.length} JSON files in directory:`, jsonFiles);
    
    // Try common distribution file names first
    const priorityFiles = ['distribution.json', 'merkle.json', 'data.json', 'recipients.json', 'airdrop.json'];
    
    // Also look for merkle-data files (common in oSnap proposals)
    const merkleDataFiles = jsonFiles.filter(f => f.includes('merkle-data') || f.includes('merkle_data'));
    if (merkleDataFiles.length > 0) {
      // Prefer chain-1 files over others
      const chain1File = merkleDataFiles.find(f => f.includes('chain-1')) || merkleDataFiles[0];
      priorityFiles.unshift(chain1File); // Add to beginning of priority list
      console.log(`[IPFS] Found merkle-data file(s), prioritizing: ${chain1File}`);
    }
    
    for (const priorityFile of priorityFiles) {
      if (jsonFiles.includes(priorityFile)) {
        try {
          console.log(`[IPFS] Attempting to fetch priority file: ${priorityFile}`);
          const fileUrl = `${gateway.url}${dirCid}/${priorityFile}`;
          const response = await fetch(fileUrl, {
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[IPFS] Successfully fetched ${priorityFile} from directory`);
            
            // Log a preview of the data structure for debugging
            const preview = JSON.stringify(data, null, 2).substring(0, 200);
            console.log(`[IPFS] Data structure preview: ${preview}...`);
            
            return data;
          }
        } catch (error) {
          console.warn(`[IPFS] Failed to fetch ${priorityFile}:`, error);
        }
      }
    }
    
    // Try other JSON files, but avoid proposal files (they contain transaction data)
    const nonProposalFiles = jsonFiles.filter(f => !f.includes('proposal'));
    
    if (nonProposalFiles.length > 0) {
      const firstFile = nonProposalFiles[0];
      try {
        console.log(`[IPFS] Attempting to fetch non-proposal file: ${firstFile}`);
        const fileUrl = `${gateway.url}${dirCid}/${firstFile}`;
        const response = await fetch(fileUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[IPFS] Successfully fetched ${firstFile} from directory`);
          return data;
        }
      } catch (error) {
        console.warn(`[IPFS] Failed to fetch ${firstFile}:`, error);
      }
    }
    
    throw new Error('Failed to fetch any JSON files from IPFS directory');
  }
  
  /**
   * Extracts JSON filenames from HTML directory listing
   */
  private extractJSONFilesFromHTML(html: string): string[] {
    const jsonFiles: string[] = [];
    
    // Match href attributes pointing to .json files
    const hrefPattern = /href=["']([^"']*\.json)["']/gi;
    let match;
    
    while ((match = hrefPattern.exec(html)) !== null) {
      let filename = match[1];
      // Remove any path prefixes
      filename = filename.split('/').pop() || filename;
      if (!jsonFiles.includes(filename)) {
        jsonFiles.push(filename);
      }
    }
    
    // Also try to match plain text .json filenames
    const textPattern = />([^<>]*\.json)</gi;
    while ((match = textPattern.exec(html)) !== null) {
      let filename = match[1].trim();
      if (!jsonFiles.includes(filename)) {
        jsonFiles.push(filename);
      }
    }
    
    return jsonFiles;
  }
  
  /**
   * Extracts CID from various IPFS URL formats
   */
  private extractCID(input: string): string | null {
    // Already a CID (QmHash format - base58, typically 46 chars total)
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(input)) {
      return input;
    }
    
    // CIDv1
    if (/^[a-z0-9]{46,}$/.test(input)) {
      return input;
    }
    
    // IPFS URLs
    const patterns = [
      /ipfs[:/]+(Qm[1-9A-HJ-NP-Za-km-z]{43,44})/,
      /ipfs[:/]+([a-z0-9]{46,})/,
      /\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{43,44})/,
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