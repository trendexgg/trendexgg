import { AnchorProvider } from "@coral-xyz/anchor";
import { Orao } from "@orao-network/solana-vrf";
import {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";
import fs from "fs";
import "dotenv/config";
import { VRF_CONFIG } from "../config/constants";
import { VRFResult, VerifyResult, SnapshotCommitResult } from "../types";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const provider = AnchorProvider.env();
const vrf = new Orao(provider);

/**
 * Commits SHA-256(snapshotFile) + snapshotSlot to Solana via memo TX.
 * MUST be called and confirmed BEFORE generateRandomness().
 * Block ordering is the cryptographic proof that the snapshot was
 * fixed before VRF randomness was known.
 */
export const commitSnapshotHash = async (
  snapshotFilePath: string,
  snapshotSlot: number
): Promise<SnapshotCommitResult> => {
  const fileBuffer = fs.readFileSync(snapshotFilePath);
  const snapshotHash = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  const memo = JSON.stringify({
    event: "modric-lottery-snapshot",
    snapshotHash,
    snapshotSlot,
    timestamp: new Date().toISOString(),
  });

  const ix = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(
    provider.connection,
    tx,
    [(provider.wallet as any).payer],
    { commitment: VRF_CONFIG.CONFIRMATION_LEVEL }
  );

  console.log("📌 Snapshot committed on-chain BEFORE VRF request");
  console.log("   SHA-256:      ", snapshotHash);
  console.log("   Snapshot slot:", snapshotSlot);
  console.log("   Memo TX:       https://solscan.io/tx/" + sig);

  return { sig, snapshotHash, snapshotSlot };
};

export const generateRandomness = async (): Promise<VRFResult> => {
  try {
    const walletAddress = provider.wallet.publicKey.toBase58();
    console.log("Using wallet:", walletAddress);
    console.log("Using provider:", provider.connection.rpcEndpoint);

    const requestBuilder = await vrf.request();
    const [seed, tx] = await requestBuilder.rpc();
    console.log("📢 Transaction sent:", tx);

    const result = await vrf.waitFulfilled(seed);

    if (!result || !result.randomness) {
      throw new Error("Failed to get randomness from VRF oracle");
    }

    const randomness = result.randomness;
    const randomnessHex = Buffer.from(randomness).toString("hex");
    const randomnessBase64 = Buffer.from(randomness).toString("base64");

    console.log("📝 Raw randomness (hex):", randomnessHex);
    console.log("📄 Raw randomness (base64):", randomnessBase64);
    console.log("\n🔧 seed used:", bs58.encode(seed));
    console.log(`signature: ${tx}`);

    return {
      randomness: Buffer.from(randomness),
      seed: bs58.encode(seed),
      tx: tx,
    };
  } catch (error) {
    console.error("❌ Error generating randomness:", error);
    throw error;
  }
};

export const verifyRandomness = async (
  seedBase58: string | Buffer,
  rpcUrl: string
): Promise<VerifyResult> => {
  try {
    const seed =
      typeof seedBase58 === "string" ? bs58.decode(seedBase58) : seedBase58;

    const connection = new Connection(rpcUrl, VRF_CONFIG.CONFIRMATION_LEVEL);
    const vrf = new Orao({ connection });

    console.log("🔍 Verifying VRF request with seed:", seedBase58);

    const result = await vrf.waitFulfilled(seed);

    if (!result || !result.randomness) {
      throw new Error("VRF request not fulfilled or randomness missing");
    }

    const randomness = Buffer.from(result.randomness);
    const randomnessHex = randomness.toString("hex");
    const randomnessBase64 = randomness.toString("base64");

    console.log("\n✅ VRF Request Verified!");
    console.log("📊 Raw randomness (hex):", randomnessHex);
    console.log("📊 Raw randomness (base64):", randomnessBase64);

    return { randomness };
  } catch (error) {
    console.error("❌ Error verifying randomness:", error);
    throw error;
  }
};
