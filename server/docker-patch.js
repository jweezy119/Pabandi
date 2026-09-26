const fs = require('fs');
const rp = 'dist/src/routes/invoicePublic.routes.js';
if (!fs.existsSync(rp)) {
  fs.writeFileSync(rp, '"use strict";Object.defineProperty(exports,"__esModule",{value:true});const express_1=require("express");const client_1=require("@prisma/client");const prisma=new client_1.PrismaClient();const router=(0,express_1.Router)();router.get("/invoices/:invoiceId",async(req,res)=>{try{const{invoiceId}=req.params;const invoice=await prisma.invoice.findUnique({where:{id:invoiceId},include:{business:{select:{id:true,name:true,solanaAddress:true,logoUrl:true}},client:{select:{id:true,name:true,email:true}}});if(!invoice)return res.status(404).json({error:"Invoice not found"});res.json({id:invoice.id,number:invoice.number,status:invoice.status,subtotal:invoice.subtotal,currency:invoice.currency||"USDC",dueDate:invoice.dateDue,lineItems:invoice.lineItems,notes:invoice.notes,paidAt:invoice.paidAt,transactionHash:invoice.transactionHash,business:{name:invoice.business.name,logoUrl:invoice.business.logoUrl,solanaAddress:invoice.business.solanaAddress},clientName:invoice.client?.name})};catch(err){res.status(500).json({error:"Failed to fetch invoice"})}});module.exports=router;');
}
const p = 'dist/src/index.js';
const c = fs.readFileSync(p, 'utf8');
if (!c.includes('Conditionally register')) {
  const marker = 'logger.info(\x60✅ ${routeMap.length} lazy API routes registered\x60)';
  const add = '\n// Conditionally register invoice public routes\ntry{const r=require("./routes/invoicePublic.routes");app.use(`/api/${v}/public/invoices`,r.default||r)}catch{logger.info("ℹ️ Invoice public lookup route not available")}';
  const idx = c.indexOf(marker);
  if (idx >= 0) { fs.writeFileSync(p, c.slice(0, idx + marker.length) + add + c.slice(idx + marker.length)); }
}
