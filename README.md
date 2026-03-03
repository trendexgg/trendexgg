# 🎰 Lucky Draw - Verifiable Random Lottery

**Official lottery script for $MODRIC token holder giveaways**

A provably fair lottery system built on Solana using **Orao VRF** for cryptographically secure and transparent winner selection.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-green.svg)](https://solana.com/)
[![Orao VRF](https://img.shields.io/badge/Orao-VRF-purple.svg)](https://www.orao.network/)

## 🌟 Overview

Official decentralized lottery system for **$MODRIC token** holder giveaways with complete transparency and verifiability.

**Key Features:**

- ✅ Cryptographic randomness via Orao VRF on-chain oracle
- ✅ Weighted selection (higher holdings = higher probability)
- ✅ Public verifiability using on-chain data
- ✅ No duplicate winners in single draw
- ✅ Deterministic and reproducible results
- ✅ On-chain snapshot commitment before VRF request (trustless)

### 🔐 Official $MODRIC Pool Creator Wallet

All $MODRIC lottery executions are performed by the verified pool creator:

```
7joaoyXCn7tvKo5vi9pVuze8Cs8FZvfcWH71r9dGeTrD
```

This public wallet address ensures transparency. All VRF transactions can be verified on Solana Explorer.

## 🔒 Trust Model

The draw process creates a fully trustless verification chain:

```
Block N        Memo TX: SHA256(snapshot.json) + snapshotSlot
                        ↓ permanently on-chain, immutable
Block N+k      VRF request TX
                        ↓ Orao oracle signs with ed25519
Block N+k+m    VRF fulfillment TX — randomness written to PDA account
```

Because Block N < Block N+k, it is **mathematically impossible** for the operator to have known the VRF output when the snapshot was committed.

**Anyone can reproduce a draw independently:**

1. Read memo TX → `snapshotHash` + `snapshotSlot`
2. `sha256(snapshot.json) == snapshotHash` — file integrity check
3. Archival RPC at `snapshotSlot` — cross-check every balance on-chain
4. Read VRF PDA account at offset `RANDOMNESS_OFFSET` — get randomness bytes
5. Run `selectFromRandomness` — reproduce winner deterministically

No step requires trusting the draw operator.

## 🏗️ How It Works

1. **Take holder snapshot** at a specific Solana slot
2. **Commit snapshot hash on-chain** via Solana Memo TX (before VRF)
3. **Request VRF randomness** from Orao Network on-chain
4. **Distribute weighted slots** - Each holder gets `floor(amount / 1000)` slots
5. **Select winners deterministically** from randomness bytes
6. **Remove winner slots** to prevent duplicates
7. **Publish results** with VRF seed, snapshot hash, and slot for public verification

## 📋 Prerequisites

- **Node.js** ≥ 21.0.0
- **Bun** runtime
- **Solana wallet** (keypair JSON) with SOL for fees

## 🚀 Quick Start

### Installation

```bash
git clone <repository-url>
cd lucky-draw
bun install
```

### Configuration

Create `.env` file:

```env
ANCHOR_WALLET=/path/to/your/keypair.json
ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com
```

### Prepare Data

Create JSON file with $MODRIC holder data (exported from project database at a specific Solana slot):

```json
[
  {
    "publicKey": "6JxzufuXUEpqqyd8THdA2vdiKEWphZBEfvEHVNxTrHos",
    "amount": 844970.830114
  }
]
```

The data file contains $MODRIC token holder addresses and their token amounts.

## 💻 Usage

### Select Winners

```bash
bun src/scripts/selectWinner.ts <data-file> <number-of-winners> <snapshot-slot>
```

**Example:**

```bash
bun src/scripts/selectWinner.ts data/modric_top_holders_jan_14_2026.json 1 393400000
```

The `snapshot-slot` is the Solana slot number at which token balances were queried. This value is committed on-chain via a memo TX before the VRF request, creating an immutable audit trail.

**Output:**

```
📋 Step 1: Committing snapshot hash on-chain...
📌 Snapshot committed on-chain BEFORE VRF request
   SHA-256:       be9a00ba90f7c557bcf9a8b094fdbf55127fd23440ed79012458ff7353c62cef
   Snapshot slot: 393400000
   Memo TX:       https://solscan.io/tx/...

🎲 Step 2: Requesting VRF randomness...
📢 Transaction sent: 5KxD...TxHash
📝 Raw randomness (hex): a3f2b1c4...

✅ Selection Complete!
{
  "winners": ["wallet1..."],
  "vrfSeed": "BvR3Np...SeedBase58",
  "signature": "5KxD...TxHash",
  "snapshotFile": "data/modric_top_holders_jan_14_2026.json",
  "snapshotHash": "be9a00ba...",
  "snapshotSlot": 393400000,
  "snapshotCommitTx": "...",
  "randomnessOffset": [40, 104],
  "timestamp": "2026-01-14T10:59:00.000Z"
}
```

**Important:** Save the entire verification record for public audit.

### Verify Winners

Anyone can verify using the VRF seed:

```bash
bun src/scripts/verifyWinner.ts <data-file> <winners-count> <vrf-seed>
```

**Example (Draws 1 & 3 — standard offset):**

```bash
bun src/scripts/verifyWinner.ts data/modric_top_holders_oct_19.json 1 2ZhsqrcNEbtHikLBQoK2mrTgJLjFSz4njPpUY9rJhpNn
bun src/scripts/verifyWinner.ts data/modric_top_holders_jan_14_2026.json 1 5DkZHCp9gbBKzcto6ezFhdFqyiqhig7cfn87Ugix36kK
```

**Example (Draw 2 — non-standard offset):**

```bash
bun src/scripts/verifyWinner.ts data/modric_top_holders_nov_01.json 1 4SLs5v8A72kEKjwBJQoMGV3rY9xcirHQLmJ6rx6uHnez --offset 73 137
```

The `--offset` flag overrides the default randomness byte window `[40:104]`. See "Historical Draw Offset Reference" below.

The verification fetches the VRF result from Solana blockchain and reproduces the same selection.

### Historical Draw Offset Reference

| Draw | Date           | Holders | Raw account bytes used | Reproducible with verifyWinner.ts? |
|------|----------------|---------|------------------------|------------------------------------|
| 1    | Oct 19, 2025   | 20      | [40:104] (standard)    | ✅ Yes                            |
| 2    | Nov 01, 2025   | 8       | [73:137] (anomaly)     | ✅ Yes (with `--offset 73 137`)   |
| 3    | Jan 14, 2026   | 140     | [40:104] (standard)    | ✅ Yes                            |

**Draw 2 offset anomaly:** Both `[40:104]` and `[73:137]` are part of the same Orao VRF output and are equally unpredictable. The announced winner is correct. The inconsistency was a script-level bug where raw account bytes were read directly instead of using the Orao SDK. This has been corrected — all future draws use the standard `[40:104]` offset as defined in `RANDOMNESS_OFFSET`.

## 🔬 Technical Details

**Weighted Slot Distribution:**
Each holder gets slots proportional to their token amount (1 slot per 1000 tokens).

**Selection Algorithm:**
Uses VRF randomness to select winners deterministically. Same seed always produces same results.

**Maximum:** 64 winners per draw

**Randomness Offset:**
The `RANDOMNESS_OFFSET` in `config/constants.ts` defines which 64-byte window of the raw Orao VRF account data is used as the randomness input. The default is `[40, 104]`, matching the Orao SDK standard.

## 🔐 Security & Transparency

**Randomness:**

- VRF ensures unpredictability (impossible to manipulate)
- All randomness generated and recorded on-chain
- Cryptographic proofs validate randomness

**Snapshot Integrity:**

- SHA-256 hash of snapshot file committed on-chain before VRF request
- Snapshot slot number recorded for archival RPC cross-verification
- Block ordering proves snapshot was fixed before randomness was known

**Best Practices:**

1. Verify transactions come from official wallet: `7joaoyXCn7tvKo5vi9pVuze8Cs8FZvfcWH71r9dGeTrD`
2. Take holder snapshots at announced Solana slot numbers
3. Commit snapshot hash on-chain before VRF request
4. Publish holder data, VRF seed, snapshot hash, and snapshot slot
5. Allow community verification period
6. Share Solana Explorer links for transparency

## 🛠️ Development

Build: `bun run build`

Type Check: `npx tsc --noEmit`

## 🙏 Acknowledgments

- [Orao Network](https://www.orao.network/) - VRF oracle provider
- [Solana](https://solana.com/) - Blockchain platform
- [Anchor](https://www.anchor-lang.com/) - Development framework

## 📝 License

ISC License

---

**Official $MODRIC lottery - Built for fair and transparent token holder rewards**
