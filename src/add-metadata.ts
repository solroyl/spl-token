import { keypairIdentity, Metaplex } from '@metaplex-foundation/js';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

// --- Environment ---
const network = (process.env.SOLANA_NETWORK as 'devnet' | 'testnet' | 'mainnet-beta') ?? 'devnet';
const connection = new Connection(clusterApiUrl(network), 'confirmed');

// --- Load Payer Keypair ---
const payerFile = process.env.PAYER_FILE ?? 'src/wallet/payer.json';
let payer: Keypair;
try {
  const payerSecret = JSON.parse(fs.readFileSync(payerFile, 'utf-8'));
  payer = Keypair.fromSecretKey(Uint8Array.from(payerSecret));
  console.log('✅ Payer loaded:', payer.publicKey.toBase58());
} catch (err) {
  console.error('❌ Failed to load payer keypair:', err);
  process.exit(1);
}

// --- Load Mint Keypair (or public key if you don't need to sign) ---
if (!process.env.VANITY_FILE) {
  console.error('❌ Missing VANITY_FILE in .env');
  process.exit(1);
}
let mintPubkey: PublicKey;
let mintKeypair: Keypair | null = null;
try {
  const vanitySecret = JSON.parse(fs.readFileSync(process.env.VANITY_FILE, 'utf-8'));
  mintKeypair = Keypair.fromSecretKey(Uint8Array.from(vanitySecret));
  mintPubkey = mintKeypair.publicKey;
  console.log('✅ Mint public key loaded:', mintPubkey.toBase58());
} catch (err) {
  console.error('❌ Failed to load vanity mint keypair:', err);
  process.exit(1);
}

// --- Create Metaplex Instance ---
const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

// --- Metadata Configuration ---
const METADATA_NAME = 'SOL Royale';
const METADATA_SYMBOL = 'SRYL';
const METADATA_URI =
  'https://raw.githubusercontent.com/solroyl/sryl-token/refs/heads/main/metadata.json';
const SELLER_FEE_BASIS_POINTS = 0; // BigInt

// --- Main Function ---
async function addMetadata() {
  try {
    // Check payer balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`ℹ️ Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      throw new Error('❌ Payer has insufficient funds. Minimum required: 0.01 SOL');
    }

    // Check if mint exists
    const mintInfo = await connection.getAccountInfo(mintPubkey);
    if (!mintInfo) {
      throw new Error(`❌ Mint address ${mintPubkey.toBase58()} does not exist.`);
    }

    // Attempt to fetch metadata using the NFTs API to check if it exists
    const existingMetadata = await metaplex
      .nfts()
      .findByMint({ mintAddress: mintPubkey })
      .catch(() => null);

    if (existingMetadata) {
      console.log('ℹ️ Metadata already exists for this mint. Updating...');

      // **FIX:** Use the `nfts()` API to update the metadata
      const { response } = await metaplex.nfts().update({
        nftOrSft: existingMetadata,
        name: METADATA_NAME,
        symbol: METADATA_SYMBOL,
        uri: METADATA_URI,
        sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
      });

      console.log('✅ Metadata successfully updated!');
      console.log('Mint address:', mintPubkey.toBase58());
      console.log('Metadata address:', existingMetadata.metadataAddress.toBase58());
      console.log('Transaction signature:', response.signature);
      return;
    }

    console.log('ℹ️ Metadata does not exist for this mint. Creating...');

    // Use the `nfts()` API to create metadata for an existing mint
    const { nft } = await metaplex.nfts().create({
      uri: METADATA_URI,
      name: METADATA_NAME,
      symbol: METADATA_SYMBOL,
      sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
      isMutable: true,
      tokenStandard: TokenStandard.Fungible,
      mintTokens: false, // Since we're using an existing mint
      mintAuthority: payer,
      updateAuthority: payer,
      useExistingMint: mintPubkey,
    });

    console.log('✅ Metadata successfully created!');
    console.log('Mint address:', mintPubkey.toBase58());
    console.log('Metadata address:', nft.metadataAddress.toBase58());
  } catch (err: any) {
    console.error('❌ Error adding metadata:', err.message || err);
    if (err.logs) {
      console.error('Transaction logs:', err.logs);
    }
  }
}

// Run the script
addMetadata().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
