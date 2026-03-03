import fs from "fs";
import { generateRandomness, commitSnapshotHash } from "../core/vrf";
import { selectFromRandomness } from "../core/selection";
import { TopHolder } from "../types";
import { validateCliArgs, validateHolders } from "../utils/validation";
import { VRF_CONFIG } from "../config/constants";

const dataFilePath: string = process.argv[2];
const numberOfSelection: number = Number(process.argv[3]);
const snapshotSlot: number = Number(process.argv[4]);

const main = async (): Promise<void> => {
  try {
    if (!dataFilePath || !process.argv[3] || !process.argv[4]) {
      console.error(
        "❌ Usage: bun selectWinner.ts <data-file-path> <number-of-winners> <snapshot-slot>"
      );
      console.error(
        "\n   snapshot-slot: The Solana slot number at which token balances were queried."
      );
      console.error(
        "   This value is committed on-chain before VRF for independent verification."
      );
      process.exit(1);
    }

    if (isNaN(snapshotSlot) || snapshotSlot <= 0) {
      console.error("❌ snapshot-slot must be a positive integer");
      process.exit(1);
    }

    validateCliArgs({ dataFilePath, numberOfWinners: numberOfSelection });

    if (!fs.existsSync(dataFilePath)) {
      throw new Error(`Data file not found: ${dataFilePath}`);
    }

    const topHolders: TopHolder[] = JSON.parse(
      fs.readFileSync(dataFilePath, "utf-8")
    );

    validateHolders(topHolders);

    // Step 1 — commit snapshot hash on-chain (before randomness is known)
    console.log("\n📋 Step 1: Committing snapshot hash on-chain...");
    console.log(`   Randomness offset: [${VRF_CONFIG.RANDOMNESS_OFFSET}]`);
    const { sig: commitTx, snapshotHash } = await commitSnapshotHash(
      dataFilePath,
      snapshotSlot
    );

    // Step 2 — request VRF randomness (in a later block)
    console.log("\n🎲 Step 2: Requesting VRF randomness...");
    const { randomness, seed, tx } = await generateRandomness();

    console.log(`\nTotal holders: ${topHolders.length}`);

    // Step 3 — select winners
    const winners = selectFromRandomness(
      topHolders,
      randomness,
      numberOfSelection
    );

    const verificationRecord = {
      winners,
      vrfSeed: seed,
      signature: tx,
      snapshotFile: dataFilePath,
      snapshotHash,
      snapshotSlot,
      snapshotCommitTx: commitTx,
      randomnessOffset: VRF_CONFIG.RANDOMNESS_OFFSET,
      timestamp: new Date().toISOString(),
    };

    console.log("\n✅ Selection Complete!");
    console.log(JSON.stringify(verificationRecord, null, 2));

    console.log("\n📌 Verification chain:");
    console.log(`   1. Snapshot memo TX: https://solscan.io/tx/${commitTx}`);
    console.log(`   2. VRF TX:           https://solscan.io/tx/${tx}`);
    console.log(`   3. Snapshot hash:    ${snapshotHash}`);
    console.log(`   4. Snapshot slot:    ${snapshotSlot}`);
    console.log(
      `   5. Randomness offset: [${VRF_CONFIG.RANDOMNESS_OFFSET}]`
    );
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
};

main();
