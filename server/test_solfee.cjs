const {Connection,Keypair,PublicKey,Transaction,SystemProgram,LAMPORTS_PER_SOL}=require('@solana/web3.js');
const bs58=require('bs58');const fs=require('fs');
const deco = (k)=> (bs58.default?bs58.default.decode(k):bs58.decode(k));
const nt=JSON.parse(fs.readFileSync('/home/peesee/.new_treasury.json','utf8'));
const kp=Keypair.fromSecretKey(deco(nt.secret_b58));
const c=new Connection('https://mainnet.helius-rpc.com/?api-key=3caa4d83-82b5-4e35-a377-799a0eb1082c','confirmed');
const FEE=new PublicKey('5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG');
(async()=>{
  console.log('treasury:',kp.publicKey.toBase58());
  const before=await c.getBalance(FEE); console.log('fee wallet before:',before/LAMPORTS_PER_SOL);
  const tx=new Transaction().add(SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:FEE,lamports:Math.round(0.0005*LAMPORTS_PER_SOL)}));
  const {blockhash}=await c.getLatestBlockhash(); tx.recentBlockhash=blockhash; tx.feePayer=kp.publicKey; tx.sign(kp);
  try{const sig=await c.sendRawTransaction(tx.serialize()); await c.confirmTransaction(sig,'confirmed'); console.log('SOL fee tx OK:',sig);}catch(e){console.log('SOL fee tx FAILED:',e.message);}
  const after=await c.getBalance(FEE); console.log('fee wallet after:',after/LAMPORTS_PER_SOL);
})().catch(e=>console.log('ERR',e.message));
