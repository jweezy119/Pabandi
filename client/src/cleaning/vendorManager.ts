import { CleaningBusinessSystem } from '../src/cleaning/businessSystem';

export class VendorManager {
  private vendors: Map<string, any> = new Map();
  private inventory: Map<string, any> = new Map();

  init() {
    // Initialize with sample vendors for cleaning supplies
    this.vendors.set('vend-001', {
      id: 'vend-001',
      name: 'CleanSupply Co.',
      contact: 'sales@cleansupply.com',
      phone: '555-0101',
      address: '123 Industrial Ave, Cityville, ST 12345',
      supplies: ['cleaning_solution', 'microfiber_cloths', 'trash_bags', 'gloves'],
      rating: 4.8,
      leadTimeDays: 2
    });
    this.vendors.set('vend-002', {
      id: 'vend-002',
      name: 'EcoClean Products',
      contact: 'orders@ecoclean.com',
      phone: '555-0102',
      address: '456 Green Blvd, Ecotown, ST 67890',
      supplies: ['eco_friendly_cleaner', 'reusable_mops', 'biodegradable_bags'],
      rating: 4.9,
      leadTimeDays: 3
    });
    this.vendors.set('vend-003', {
      id: 'vend-003',
      name: 'QuickShip Supplies',
      contact: 'support@quickship.com',
      phone: '555-0103',
      address: '789 Fast Lane, Shipville, ST 54321',
      supplies: ['vacuum_bags', 'filters', 'scrub_brushes', 'squeegees'],
      rating: 4.5,
      leadTimeDays: 1
    });

    // Initialize inventory with common cleaning supplies
    this.inventory.set('cleaning_solution', {
      id: 'cleaning_solution',
      name: 'All-Purpose Cleaning Solution',
      unit: 'gallon',
      minStockLevel: 10,
      currentStock: 25,
      reorderPoint: 15,
      preferredVendor: 'vend-001',
      costPerUnit: 12.50
    });
    this.inventory.set('microfiber_cloths', {
      id: 'microfiber_cloths',
      name: 'Microfiber Cleaning Cloths (12-pack)',
      unit: 'pack',
      minStockLevel: 20,
      currentStock: 40,
      reorderPoint: 25,
      preferredVendor: 'vend-001',
      costPerUnit: 8.75
    });
    this.inventory.set('eco_friendly_cleaner', {
      id: 'eco_friendly_cleaner',
      name: 'Eco-Friendly Citrus Cleaner',
      unit: 'spray_bottle',
      minStockLevel: 15,
      currentStock: 30,
      reorderPoint: 20,
      preferredVendor: 'vend-002',
      costPerUnit: 9.25
    });
    this.inventory.set('vacuum_bags', {
      id: 'vacuum_bags',
      name: 'HEPA Vacuum Bags (6-pack)',
      unit: 'pack',
      minStockLevel: 12,
      currentStock: 18,
      reorderPoint: 10,
      preferredVendor: 'vend-003',
      costPerUnit: 15.00
    });
  }

  /**
   * Get all vendors
   * @returns Array of vendor objects
   */
  getAllVendors(): Array<any> {
    return Array.from(this.vendors.values());
  }

  /**
   * Get vendor by ID
   * @param vendorId - Vendor ID
   * @returns Vendor object or null
   */
  getVendorById(vendorId: string): any | null {
    return this.vendors.get(vendorId) || null;
  }

  /**
   * Add a new vendor
   * @param vendorData - Vendor information
   * @returns Created vendor object
   */
  addVendor(vendorData: any): any {
    const vendor = {
      id: `vend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...vendorData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vendors.set(vendor.id, vendor);
    return vendor;
  }

  /**
   * Update vendor information
   * @param vendorId - Vendor ID
   * @param updates - Fields to update
   * @returns Updated vendor object
   */
  updateVendor(vendorId: string, updates: any): any | null {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) return null;

    const updatedVendor = {
      ...vendor,
      ...updates,
      updatedAt: new Date()
    };
    this.vendors.set(vendorId, updatedVendor);
    return updatedVendor;
  }

  /**
   * Get current inventory levels
   * @returns Array of inventory items with stock levels
   */
  getInventory(): Array<any> {
    return Array.from(this.inventory.values()).map(item => ({
      ...item,
      stockStatus: this.getStockStatus(item.currentStock, item.minStockLevel)
    }));
  }

  /**
   * Get inventory item by ID
   * @param itemId - Inventory item ID
   * @returns Inventory item or null
   */
  getInventoryItem(itemId: string): any | null {
    return this.inventory.get(itemId) || null;
  }

  /**
   * Update inventory stock level
   * @param itemId - Inventory item ID
   * @param quantityChange - Change in quantity (positive for addition, negative for usage)
   * @returns Updated inventory item
   */
  updateInventoryStock(itemId: string, quantityChange: number): any | null {
    const item = this.inventory.get(itemId);
    if (!item) return null;

    const newStock = Math.max(0, item.currentStock + quantityChange);
    const updatedItem = {
      ...item,
      currentStock: newStock,
      updatedAt: new Date(),
      stockStatus: this.getStockStatus(newStock, item.minStockLevel)
    };
    this.inventory.set(itemId, updatedItem);
    return updatedItem;
  }

  /**
   * Check if reorder is needed for an item
   * @param itemId - Inventory item ID
   * @returns Boolean indicating if reorder is needed
   */
  needsReorder(itemId: string): boolean {
    const item = this.inventory.get(itemId);
    if (!item) return false;
    return item.currentStock <= item.reorderPoint;
  }

  /**
   * Get items that need reordering
   * @returns Array of inventory items needing reorder
   */
  getReorderList(): Array<any> {
    return Array.from(this.inventory.values())
      .filter(item => this.needsReorder(item.id))
      .map(item => ({
        ...item,
        suggestedQuantity: Math.max(item.minStockLevel * 2, item.minStockLevel + 10),
        preferredVendorId: item.preferredVendor,
        vendorName: this.vendors.get(item.preferredVendor)?.name || 'Unknown Vendor'
      }));
  }

  /**
   * Create a purchase order for reordering supplies
   * @param vendorId - Vendor ID
   * @param items - Array of items to order with quantities
   * @returns Purchase order object
   */
  createPurchaseOrder(vendorId: string, items: Array<{ itemId: string; quantity: number }>): any {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }

    const orderItems = items.map(item => {
      const inventoryItem = this.inventory.get(item.itemId);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${item.itemId} not found`);
      }
      return {
        itemId: inventoryItem.id,
        name: inventoryItem.name,
        quantity: item.quantity,
        unitPrice: inventoryItem.costPerUnit,
        total: item.quantity * inventoryItem.costPerUnit
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.08; // Assuming 8% sales tax
    const total = subtotal + tax;

    const po = {
      id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendorId,
      vendorName: vendor.name,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + vendor.leadTimeDays * 24 * 60 * 60 * 1000),
      items: orderItems,
      subtotal,
      tax,
      total,
      status: 'pending'
    };

    return po;
  }

  /**
   * Record usage of supplies for a job
   * @param jobId - Job ID
   * @param usage - Array of items used with quantities
   */
  recordSupplyUsage(jobId: string, usage: Array<{ itemId: string; quantity: number }>) {
    usage.forEach(item => {
      this.updateInventoryStock(item.itemId, -item.quantity); // Negative for usage
    });

    // In a real system, this would also be logged against the job for cost tracking
    return {
      jobId,
      timestamp: new Date(),
      usage: usage.map(u => ({
        itemId: u.itemId,
        itemName: this.inventory.get(u.itemId)?.name || 'Unknown Item',
        quantity: u.quantity
      }))
    };
  }

  private getStockStatus(currentStock: number, minStockLevel: number): 'ok' | 'low' | 'critical' {
    const ratio = currentStock / minStockLevel;
    if (ratio >= 2) return 'ok';
    if (ratio >= 1) return 'low';
    return 'critical';
  }
}

export default VendorManager;