import { getMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js';
import 'dotenv/config';
import fs from 'fs';

const network = process.env.SOLANA_NETWORK ?? 'devnet';
const url = clusterApiUrl(network as 'devnet' | 'testnet' | 'mainnet-beta');
const connection = new Connection(url);

// Load payer wallet (mints + pays fees)
const payerFile = process.env.PAYER_FILE ?? 'src/wallet/payer.json';
const payerSecretKey = JSON.parse(fs.readFileSync(payerFile, 'utf-8'));
const payer = Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));

// Load vanity mint address
if (!process.env.VANITY_FILE) {
  throw new Error('❌ Missing VANITY_FILE in .env');
}
const vanityFile = process.env.VANITY_FILE;
const vanitySecretKey = JSON.parse(fs.readFileSync(vanityFile, 'utf-8'));
const vanityKeypair = Keypair.fromSecretKey(Uint8Array.from(vanitySecretKey));

// Load decimals and human-readable target
const decimals = parseInt(process.env.DECIMALS ?? '9', 10);
const humanAmount = BigInt(process.env.MINT_AMOUNT ?? '0');

// Convert human-readable → base units
const targetSupply = humanAmount * BigInt(10 ** decimals);

(async () => {
  const mintInfo = await getMint(connection, vanityKeypair.publicKey);
  const currentSupply = mintInfo.supply;

  console.log('ℹ️ Current supply:', currentSupply.toString());
  console.log('🎯 Target supply:', targetSupply.toString());

  if (currentSupply >= targetSupply) {
    console.log('✅ Supply already at or above target. No minting needed.');
    return;
  }

  // Difference to mint
  const amountToMint = targetSupply - currentSupply;
  console.log('🪙 Need to mint extra:', amountToMint.toString());

  // Create (or fetch) payer's ATA
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    vanityKeypair.publicKey,
    payer.publicKey
  );

  // Mint only the difference
  await mintTo(
    connection,
    payer,
    vanityKeypair.publicKey,
    ata.address,
    payer, // mint authority
    amountToMint
  );

  console.log(`✅ Minted ${amountToMint} tokens to ${ata.address.toBase58()}`);
})();
