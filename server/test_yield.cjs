const {Connection,Keypair,PublicKey,Transaction,LAMPORTS_PER_SOL,sendAndConfirmTransaction,SystemProgram}=require('@solana/web3.js');
const bs58=require('bs58');const fs=require('fs');
const deco=k=>Keypair.fromSecretKey((bs58.default?bs58.default:bs58).decode(k));
const kp=deco(JSON.parse(fs.readFileSync('/home/peesee/.new_treasury.json','utf8')).secret_b58);
const FEE=new PublicKey('5AR6fsezB8NTYQWwP1DxysuKPZAEY12yeVt22hL6FvdG');
const c=new Connection('https://mainnet.helius-rpc.com/?api-key=3caa4d83-82b5-4e35-a377-799a0eb1082c','confirmed');

(async()=>{
  // Use the treasury wallet AS the "user" (external payer) — no extra funding needed.
  // This proves: external SOL enters, 0.5% skims to fee wallet, rest routes to yield vault.
  const user=kp;
  const solAmount=0.002;
  const before=await c.getBalance(FEE);
  console.log('fee wallet before:',(before/LAMPORTS_PER_SOL).toFixed(6));

  const r=await fetch('https://pabandi.onrender.com/api/v1/economy/route-yield',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:user.publicKey.toBase58(),solAmount})});
  const j=await r.json();
  if(!j.success){console.log('route err',j);return;}
  const {serializedTx,platformFeeSol,bookingRef}=j.data;
  console.log('route: fee',platformFeeSol,'bookingRef',bookingRef);

  const tx=Transaction.from(Buffer.from(serializedTx,'base64'));
  tx.partialSign(user); // user (treasury) signs its legs
  const sig=await sendAndConfirmTransaction(c,tx,[]);
  console.log('YIELD TX:',sig);

  const cf=await fetch('https://pabandi.onrender.com/api/v1/economy/confirm-yield',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingRef,txHash:sig})});
  const cj=await cf.json();
  console.log('confirm:',JSON.stringify(cj));

  const after=await c.getBalance(FEE);
  console.log('FEE WALLET after:',(after/LAMPORTS_PER_SOL).toFixed(6),'(expect +'+platformFeeSol+')');
})().catch(e=>console.log('ERR',e.message));
