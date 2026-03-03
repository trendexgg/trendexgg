export type TopHolder = {
  publicKey: string;
  amount: number;
};

export type VRFResult = {
  randomness: Buffer;
  seed: string;
  tx: string;
};

export type VerifyResult = {
  randomness: Buffer;
};

export type SelectionResult = {
  winners: string[];
  vrfSeed: string;
  signature: string;
};

export type SnapshotCommitResult = {
  /** Transaction signature of the on-chain memo commitment */
  sig: string;
  /** SHA-256 hash of the snapshot file */
  snapshotHash: string;
  /** Solana slot used as the balance cutoff for the snapshot */
  snapshotSlot: number;
};
