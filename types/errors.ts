export class VerificationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

export class IPFSError extends Error {
  constructor(
    message: string,
    public gateway?: string,
    public cid?: string
  ) {
    super(message);
    this.name = 'IPFSError';
  }
}

export class SnapshotError extends Error {
  constructor(
    message: string,
    public proposalId?: string
  ) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export class MerkleTreeError extends Error {
  constructor(
    message: string,
    public format?: string
  ) {
    super(message);
    this.name = 'MerkleTreeError';
  }
}