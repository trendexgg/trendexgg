import fs from "fs";
import { Connection } from "@solana/web3.js";
import { Orao } from "@orao-network/solana-vrf";
import bs58 from "bs58";
import minimist from "minimist";
import "dotenv/config";
import { selectFromRandomness } from "../core/selection";
import { TopHolder } from "../types";
import { validateCliArgs, validateHolders } from "../utils/validation";
import { VRF_CONFIG } from "../config/constants";

const argv = minimist(process.argv.slice(2));
const dataFilePath: string = argv._[0];
const selectedCount: number = Number(argv._[1]);
const seed: string = argv._[2];
const offsetArg: number[] | undefined = argv.offset
  ? (Array.isArray(argv.offset) ? argv.offset : [argv.offset]).map(Number)
  : undefined;

const main = async (): Promise<void> => {
  try {
    if (!dataFilePath || !argv._[1] || !seed) {
      console.error(
        "❌ Usage: bun verifyWinner.ts <data-file-path> <number-of-winners> <vrf-seed> [--offset <start> <end>]"
      );
      console.error(
        "\n   --offset <start> <end>  Override the randomness byte offset (default: [40, 104])"
      );
      console.error(
        "                           Use --offset 73 137 to reproduce Draw 2"
      );
      process.exit(1);
    }

    // Determine randomness offset
    const offset: [number, number] = offsetArg && offsetArg.length === 2
      ? [offsetArg[0], offsetArg[1]]
      : [...VRF_CONFIG.RANDOMNESS_OFFSET];

    const expectedBytes = offset[1] - offset[0];
    if (expectedBytes !== 64) {
      console.error(
        `❌ Offset range must span exactly 64 bytes, got ${expectedBytes} ([${offset}])`
      );
      process.exit(1);
    }

    validateCliArgs({
      dataFilePath,
      numberOfWinners: selectedCount,
      seed,
    });

    if (!fs.existsSync(dataFilePath)) {
      throw new Error(`Data file not found: ${dataFilePath}`);
    }

    const topHolders: TopHolder[] = JSON.parse(
      fs.readFileSync(dataFilePath, "utf-8")
    );

    validateHolders(topHolders);

    if (!process.env.ANCHOR_PROVIDER_URL) {
      throw new Error("ANCHOR_PROVIDER_URL is not set");
    }

    console.log(`🔍 Verifying with offset: [${offset}]`);

    let randomness: Buffer;

    if (offset[0] === VRF_CONFIG.RANDOMNESS_OFFSET[0] && offset[1] === VRF_CONFIG.RANDOMNESS_OFFSET[1]) {
      // Standard offset — use Orao SDK (matches historical default)
      const connection = new Connection(
        process.env.ANCHOR_PROVIDER_URL,
        VRF_CONFIG.CONFIRMATION_LEVEL
      );
      const orao = new Orao({ connection });
      const seedBytes =
        typeof seed === "string" ? bs58.decode(seed) : seed;

      console.log("🔍 Verifying VRF request with seed:", seed);
      const result = await orao.waitFulfilled(seedBytes);

      if (!result || !result.randomness) {
        throw new Error("VRF request not fulfilled or randomness missing");
      }

      randomness = Buffer.from(result.randomness);
    } else {
      // Non-standard offset — read raw account data to use custom byte window
      // This is needed for Draw 2 which used [73:137] instead of the SDK default [40:104]
      console.log(
        `⚠️  Using non-standard offset [${offset}] — reading raw account data`
      );

      const connection = new Connection(
        process.env.ANCHOR_PROVIDER_URL,
        VRF_CONFIG.CONFIRMATION_LEVEL
      );
      const orao = new Orao({ connection });
      const seedBytes =
        typeof seed === "string" ? bs58.decode(seed) : seed;

      // Get the PDA address for this seed
      const result = await orao.waitFulfilled(seedBytes);
      if (!result || !result.randomness) {
        throw new Error("VRF request not fulfilled or randomness missing");
      }

      // Read raw account data to extract bytes at custom offset
      const accountInfo = await connection.getAccountInfo(
        result.publicKey || (orao as any).randomnessAccountAddress(seedBytes)
      );

      if (!accountInfo) {
        throw new Error("Could not fetch raw VRF account data");
      }

      randomness = Buffer.from(
        accountInfo.data.slice(offset[0], offset[1])
      );

      if (randomness.length !== 64) {
        throw new Error(
          `Expected 64 bytes at offset [${offset}], got ${randomness.length}`
        );
      }
    }

    const randomnessHex = randomness.toString("hex");
    console.log("\n✅ VRF Request Verified!");
    console.log("📊 Raw randomness (hex):", randomnessHex);
    console.log(
      `📊 Offset used: [${offset}]${offset[0] !== VRF_CONFIG.RANDOMNESS_OFFSET[0]
        ? " (non-standard — Draw 2 anomaly)"
        : " (standard)"
      }`
    );

    const winners = selectFromRandomness(topHolders, randomness, selectedCount);

    console.log("\n✅ Verified winners from the seed:");
    console.log(winners);
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
};

main();
