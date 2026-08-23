const {Connection,PublicKey}=require('@solana/web3.js');
const {getAssociatedTokenAddress}=require('@solana/spl-token');
const c=new Connection('https://mainnet.helius-rpc.com/?api-key=3caa4d83-82b5-4e35-a377-799a0eb1082c','confirmed');
const MINT=new PublicKey('4MLskKmcnz8bVaPfEuVbhZGsbeUMZqKjQYQQDEX6WQcQ');
const TREAS=new PublicKey('38HR8BoGrGeM4fKHsfyWARrW9b8kLbZeYgEHEXAFFrZ2');
(async()=>{
const a=await getAssociatedTokenAddress(MINT,TREAS); const a58=a.toBase58();
console.log('treasury PAB ATA:',a58);
const sig='23qx6zKb4ahgdV3cYqB75dvtc4oappNy1FhSvDsvoWMdRbqw2KKvAWRTpW7wEvzWhnXbfvd1zqtMVW9kwXyiBfK2';
const t=await c.getTransaction(sig,{maxSupportedCommitment:'confirmed'});
if(!t){console.log('NOT FOUND');return;}
console.log('ix count:',t.transaction.message.instructions.length);
// account keys involved
const keys=t.transaction.message.accountKeys;
// pre/post token balances
const pre=t.meta.preTokenBalances||[]; const post=t.meta.postTokenBalances||[];
const mk=(b)=>b.accountId?b.accountId.toBase58().slice(0,8):b.accountId;
const lookup=(b)=> { const k=b.accountId? (typeof b.accountId.toBase58==='function'?b.accountId.toBase58():b.accountId):'(null)'; return k; };
console.log('--- preTokenBalances ---');
for(const b of pre) if(b.mint===MINT.toBase58()) console.log('  acct',lookup(b),'amt',b.uiTokenAmount?b.uiTokenAmount.amount:'-');
console.log('--- postTokenBalances ---');
for(const b of post) if(b.mint===MINT.toBase58()) console.log('  acct',lookup(b),'amt',b.uiTokenAmount?b.uiTokenAmount.amount:'-');
})().catch(e=>console.log('ERR',e.message));
