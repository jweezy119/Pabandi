const {Connection,PublicKey}=require('@solana/web3.js');
const c=new Connection('https://mainnet.helius-rpc.com/?api-key=3caa4d83-82b5-4e35-a377-799a0eb1082c','confirmed');
const FEE=new PublicKey('5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG');
const TREAS=new PublicKey('38HR8BoGrGeM4fKHsfyWARrW9b8kLbZeYgEHEXAFFrZ2');
const sig=process.argv[2];
(async()=>{
const t=await c.getTransaction(sig,{maxSupportedCommitment:'confirmed'});
if(!t){console.log('NOT FOUND');return;}
console.log('ix count:',t.transaction.message.instructions.length);
for(const ix of t.transaction.message.instructions) console.log('  prog',ix.programId.toBase58().slice(0,8),'accounts',ix.accounts.length);
// check if fee wallet is in the tx's account keys
const keys=t.transaction.message.accountKeys.map(k=>k.toBase58());
console.log('fee wallet in tx?',keys.includes(FEE.toBase58()));
console.log('treasury in tx?',keys.includes(TREAS.toBase58()));
// post balances for fee wallet
const post=(t.meta.postTokenBalances||[]).concat(t.meta.postBalances?[]:[]);
const fb=t.meta.postBalances; // SOL, parallel to accountKeys
const idx=keys.indexOf(FEE.toBase58());
if(idx>=0) console.log('fee wallet post SOL (lamports):',fb[idx]);
})().catch(e=>console.log('ERR',e.message));
