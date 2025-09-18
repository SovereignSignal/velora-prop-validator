export interface IPFSResponse {
  data: any;
  gateway: string;
  cid: string;
  retrievedAt: string;
  attempts: number;
}

export interface IPFSGateway {
  url: string;
  priority: number;
  timeout: number;
  rateLimitMs?: number;
}