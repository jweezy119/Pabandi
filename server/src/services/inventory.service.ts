// ═══════════════════════════════════════════════════════════════════════════════
// NIGHTLIFE INVENTORY SYSTEM
// Open-source style inventory for clubs, bars, and venues
// Features: bottle tracking, par levels, waste, vendors, purchase orders
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const inventoryService = {
  // ── PRODUCTS (Bottles, Mixers, Supplies) ─────────────────────────────────
  
  async createProduct(data: any) {
    return prisma.inventoryProduct.create({ data });
  },

  async getProducts(venueId: string) {
    return prisma.inventoryProduct.findMany({
      where: { venueId },
      include: { category: true, vendor: true },
      orderBy: { name: 'asc' },
    });
  },

  async updateStock(productId: string, quantity: number, reason: string) {
    const product = await prisma.inventoryProduct.findUnique({ where: { id: productId } });
    if (!product) return null;

    const newQuantity = product.currentStock + quantity;

    const update = await prisma.inventoryProduct.update({
      where: { id: productId },
      data: { currentStock: newQuantity },
    });

    // Log the transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId,
        type: quantity > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(quantity),
        reason,
        balanceAfter: newQuantity,
      },
    });

    // Check if below par level
    if (newQuantity <= product.parLevel) {
      await this.triggerLowStockAlert(productId);
    }

    return update;
  },

  // ── LOW STOCK ALERTS & AUTO-REORDER ───────────────────────────────────────
  
  async triggerLowStockAlert(productId: string) {
    const product = await prisma.inventoryProduct.findUnique({
      where: { id: productId },
      include: { vendor: true },
    });

    if (!product) return;

    // In production: notify venue manager via push/email/WhatsApp
    console.log(`LOW STOCK ALERT: ${product.name} at ${product.currentStock} (par: ${product.parLevel})`);

    // Auto-create purchase order if enabled
    if (product.autoReorder && product.vendorId) {
      await this.createPurchaseOrder({
        vendorId: product.vendorId,
        venueId: product.venueId,
        items: [{ productId, quantity: product.reorderQuantity || product.parLevel * 2 }],
      });
    }
  },

  // ── VENDORS ───────────────────────────────────────────────────────────────
  
  async createVendor(data: any) {
    return prisma.inventoryVendor.create({ data });
  },

  async getVendors(venueId: string) {
    return prisma.inventoryVendor.findMany({
      where: { venueId },
      include: { products: true, purchaseOrders: true },
    });
  },

  // ── PURCHASE ORDERS ────────────────────────────────────────────────────────
  
  async createPurchaseOrder(data: any) {
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
    
    return prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: data.vendorId,
        venueId: data.venueId,
        status: 'DRAFT',
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice || 0,
          })),
      },
      },
      include: { items: { include: { product: true } }, vendor: true },
    });
  },

  async submitPurchaseOrder(poId: string) {
    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  },

  async receivePurchaseOrder(poId: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!po) return null;

    // Update stock for each item
    for (const item of po.items) {
      await this.updateStock(item.productId, item.quantity, `PO ${po.poNumber} received`);
    }

    return prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'RECEIVED', receivedAt: new Date() },
    });
  },

  // ── WASTE TRACKING ────────────────────────────────────────────────────────
  
  async recordWaste(data: any) {
    const product = await prisma.inventoryProduct.findUnique({ where: { id: data.productId } });
    if (!product) return null;

    // Reduce stock
    await this.updateStock(data.productId, -data.quantity, `Waste: ${data.reason}`);

    return prisma.wasteRecord.create({ data });
  },

  async getWasteReport(venueId: string, startDate: Date, endDate: Date) {
    return prisma.wasteRecord.findMany({
      where: { venueId, createdAt: { gte: startDate, lte: endDate } },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── INVENTORY VALUATION ────────────────────────────────────────────────────
  
  async getInventoryValue(venueId: string) {
    const products = await prisma.inventoryProduct.findMany({ where: { venueId } });

    const totalValue = products.reduce((sum: number, p: any) => sum + (p.currentStock * p.unitPrice), 0);
    const totalItems = products.reduce((sum: number, p: any) => sum + p.currentStock, 0);
    const lowStockCount = products.filter((p: any) => p.currentStock <= p.parLevel).length;

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalItems,
      lowStockCount,
      productCount: products.length,
    };
  },

  // ── INVENTORY REPORT ───────────────────────────────────────────────────────
  
  async getInventoryReport(venueId: string) {
    const [products, value, recentTransactions, wasteReport] = await Promise.all([
      prisma.inventoryProduct.findMany({ where: { venueId }, include: { category: true } }),
      this.getInventoryValue(venueId),
      prisma.inventoryTransaction.findMany({
        where: { product: { venueId } },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.wasteRecord.findMany({
        where: { venueId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      products,
      value,
      recentTransactions,
      wasteReport,
    };
  },
};
