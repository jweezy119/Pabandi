import { CRMService, ContactStatus, LeadSource, ActivityType } from './crm';
import PaymentService from '../services/payment';
import { VendorManager } from './vendorManager';
import { RouteOptimizer } from './routeOptimizer';
import { EmployeeManager } from './employeeManager';
import { SubscriptionEngine } from './subscriptionEngine';
import { DiscountEngine } from './discountEngine';
import { ReportingService } from './reportingService';

/**
 * Service Account Interface
 */
export interface ServiceAccount {
  id: string;
  contactId: string; // Links to CRM contact
  name: string; // Business or household name
  contactInfo: string; // Phone, email, etc.
  services: string[]; // List of services offered/subscribed to
  status: 'active' | 'inactive' | 'suspended';
  subscriptionTier: 'basic' | 'premium' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
  notes?: string[];
  customFields?: Record<string, any>;
}

/**
 * Job/Appointment Interface
 */
export interface Job {
  id: string;
  serviceAccountId: string; // Links to service account
  contactId: string; // Links to CRM contact (denormalized for easy access)
  address: string;
  date: string; // YYYY-MM-DD
  duration: number; // hours
  assignedEmployee: string; // Employee ID
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  createdAt: Date;
  updatedAt: Date;
  addOnServices?: string[];
  notes?: string[];
  paymentMethod?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  amount?: number;
}

/**
 * Report Interface
 */
export interface Report {
  clientId: string;
  name: string;
  totalSpent: number;
  discountApplied: number;
  upcomingAppointments: Array<any>;
  subscriptionTier: string;
  lastActivity: Date;
}

/**
 * Main Cleaning Business System
 * Orchestrates all subsystems for a cleaning business
 */
export class CleaningBusinessSystem {
  private crmService: CRMService;
  private routeOptimizer: RouteOptimizer;
  private employeeManager: EmployeeManager;
  private subscriptionEngine: SubscriptionEngine;
  private discountEngine: DiscountEngine;
  private reportingService: ReportingService;
  private vendorManager: VendorManager;
  private paymentService: PaymentService;
  
  // Service and Job management
  private serviceAccounts: Map<string, ServiceAccount> = new Map();
  private jobs: Map<string, Job> = new Map();
  
  constructor() {
    this.crmService = new CRMService();
    this.routeOptimizer = new RouteOptimizer();
    this.employeeManager = new EmployeeManager();
    this.subscriptionEngine = new SubscriptionEngine();
    this.discountEngine = new DiscountEngine();
    this.reportingService = new ReportingService();
    this.vendorManager = new VendorManager();
    this.paymentService = new PaymentService();
  }

  /**
   * Initialize the cleaning business system
   */
  init() {
    // Initialize subsystems that have explicit init() methods
    this.routeOptimizer.init();
    this.employeeManager.init();
    this.vendorManager.init();
    // Other subsystems initialize in their constructors or declarations
  }

  /**
   * Generate a unique ID
   * @returns Unique identifier string
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Create a new service account (client profile)
   * @param name - Business/household name
   * @param contactInfo - Contact details (phone, email, etc.)
   * @param services - List of services offered/subscribed to
   * @param contactId - Optional CRM contact ID to link to
   * @returns Created service account
   */
  async createServiceAccount(
    name: string, 
    contactInfo: string, 
    services: string[],
    contactId?: string
  ): Promise<ServiceAccount> {
    const account: ServiceAccount = {
      id: this.generateId(),
      contactId: contactId || '',
      name,
      contactInfo,
      services,
      status: 'active',
      subscriptionTier: 'basic',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.serviceAccounts.set(account.id, account);
    
    // If a contact ID was provided, we could update the contact to link to this service account
    // For now, we'll just note the relationship
    
    console.log(`✅ Created service account: ${name} (${account.id})`);
    return account;
  }

  /**
   * Get service account by ID
   * @param serviceAccountId - Service account ID
   * @returns Service account or null if not found
   */
  getServiceAccount(serviceAccountId: string): ServiceAccount | null {
    return this.serviceAccounts.get(serviceAccountId) || null;
  }

  /**
   * Update service account
   * @param serviceAccountId - Service account ID
   * @param updates - Partial service account updates
   * @returns Updated service account or null if not found
   */
  updateServiceAccount(
    serviceAccountId: string, 
    updates: Partial<Omit<ServiceAccount, 'id' | 'createdAt'>>
  ): ServiceAccount | null {
    const account = this.serviceAccounts.get(serviceAccountId);
    if (!account) return null;
    
    const updatedAccount: ServiceAccount = {
      ...account,
      ...updates,
      updatedAt: new Date()
    };
    
    this.serviceAccounts.set(serviceAccountId, updatedAccount);
    console.log(`✅ Updated service account: ${updatedAccount.name} (${serviceAccountId})`);
    return updatedAccount;
  }

  /**
   * Get all service accounts with optional filtering
   * @param filters - Filter criteria
   * @returns Array of service accounts
   */
  getServiceAccounts(filters?: {
    status?: 'active' | 'inactive' | 'suspended';
    subscriptionTier?: 'basic' | 'premium' | 'enterprise';
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): ServiceAccount[] {
    let results = Array.from(this.serviceAccounts.values());
    
    // Apply filters
    if (filters) {
      if (filters.status) {
        results = results.filter(account => account.status === filters.status);
      }
      
      if (filters.subscriptionTier) {
        results = results.filter(account => account.subscriptionTier === filters.subscriptionTier);
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(account => 
          account.name.toLowerCase().includes(term) ||
          account.contactInfo.toLowerCase().includes(term) ||
          account.services.some(service => service.toLowerCase().includes(term))
        );
      }
    }
    
    // Sort by most recently updated
    results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    // Apply pagination
    if (filters?.offset !== undefined) {
      results = results.slice(filters.offset);
    }
    if (filters?.limit !== undefined) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  /**
   * Schedule a cleaning job/appointment
   * @param serviceAccountId - Service account ID
   * @param address - Service address
   * @param date - Appointment date (YYYY-MM-DD)
   * @param duration - Service duration (hours)
   * @param assignedEmployee - Employee to assign
   * @param paymentMethod - Payment method to use (credit_card, paypal, bank_transfer, cash_on_arrival)
   * @returns Created job with payment processing
   */
  async scheduleJob(
    serviceAccountId: string,
    address: string,
    date: string,
    duration: number,
    assignedEmployee: string,
    paymentMethod: string = 'credit_card'
  ): Promise<Job & { paymentResult?: any }> {
    // Get the service account
    const serviceAccount = this.getServiceAccount(serviceAccountId);
    if (!serviceAccount) {
      throw new Error(`Service account ${serviceAccountId} not found`);
    }
    
    // Get the linked contact (if any)
    const contactId = serviceAccount.contactId;
    const contact = contactId ? this.crmService.getContact(contactId) : null;
    
    // Create the job
    const job: Job = {
      id: this.generateId(),
      serviceAccountId,
      contactId: contactId || '',
      address,
      date,
      duration,
      assignedEmployee,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentMethod,
      paymentStatus: 'pending'
    };
    
    this.jobs.set(job.id, job);
    
    // Log activity in CRM if contact exists
    if (contactId) {
      this.crmService.logActivity({
        contactId,
        type: ActivityType.FOLLOW_UP,
        subject: `Job scheduled`,
        description: `Cleaning job scheduled for ${date} at ${address}`,
        performedBy: 'system',
        performedAt: new Date(),
        isCompleted: true
      });
      
      // Update contact's last contacted time and next follow-up
      this.crmService.updateContact(contactId, {
        lastContactedAt: new Date(),
        nextFollowUpAt: this.crmService.calculateNextFollowUpDate(
          contact.status || ContactStatus.CLIENT
        )
      });
    }
    
    // Process payment based on selected method
    let paymentResult: any = null;
    try {
      switch (paymentMethod) {
        case 'credit_card':
          paymentResult = await this.paymentService.processPayment(
            job.id, 
            job.amount || 0, 
            paymentMethod
          );
          break;
        case 'paypal':
          paymentResult = await this.paymentService.processPayment(
            job.id, 
            job.amount || 0, 
            'paypal'
          );
          break;
        case 'bank_transfer':
          paymentResult = await this.paymentService.processBankTransfer(
            job.id, 
            job.amount || 0
          );
          break;
        case 'cash_on_arrival':
          paymentResult = await this.paymentService.processOnrampPayment(
            job.id, 
            job.amount || 0
          );
          break;
        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }
      
      // Update job with payment result
      if (paymentResult) {
        job.paymentStatus = paymentResult.status === 'charged' ? 'paid' : 'failed';
        job.paymentResult = paymentResult;
        this.jobs.set(job.id, job); // Update in map
      }
    } catch (paymentError) {
      console.warn(`Payment processing failed for job ${job.id}:`, paymentError.message);
      job.paymentStatus = 'failed';
      this.jobs.set(job.id, job);
    }
    
    console.log(`✅ Scheduled job: ${job.id} for service account ${serviceAccountId}`);
    return { ...job, paymentResult };
  }

  /**
   * Get job by ID
   * @param jobId - Job ID
   * @returns Job or null if not found
   */
  getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Update job status
   * @param jobId - Job ID
   * @param status - New status
   * @returns Updated job or null if not found
   */
  updateJobStatus(jobId: string, status: Job['status']): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    
    const updatedJob: Job = {
      ...job,
      status,
      updatedAt: new Date()
    };
    
    this.jobs.set(jobId, updatedJob);
    
    // Log activity in CRM if contact exists
    if (job.contactId) {
      let activityType: ActivityType;
      let description: string;
      
      switch (status) {
        case 'completed':
          activityType = ActivityType.FOLLOW_UP;
          description = `Job completed successfully`;
          break;
        case 'cancelled':
          activityType = ActivityType.FOLLOW_UP;
          description = `Job cancelled`;
          break;
        case 'no_show':
          activityType = ActivityType.FOLLOW_UP;
          description = `Customer no-show for job`;
          break;
        case 'in_progress':
          activityType = ActivityType.FOLLOW_UP;
          description = `Job started`;
          break;
        default:
          activityType = ActivityType.FOLLOW_UP;
          description = `Job status updated to ${status}`;
      }
      
      this.crmService.logActivity({
        contactId: job.contactId,
        type: activityType,
        subject: `Job status update`,
        description,
        performedBy: 'system',
        performedAt: new Date(),
        isCompleted: true
      });
      
      // If job is completed, update contact's job count and last job date
      if (status === 'completed') {
        const contact = this.crmService.getContact(job.contactId);
        if (contact) {
          this.crmService.updateContact(job.contactId, {
            jobCount: (contact.jobCount || 0) + 1,
            lastJobAt: new Date(),
            totalValue: (contact.totalValue || 0) + (job.amount || 0)
          });
        }
      }
    }
    
    console.log(`✅ Updated job ${jobId} status to ${status}`);
    return updatedJob;
  }

  /**
   * Get jobs for a service account
   * @param serviceAccountId - Service account ID
   * @param filters - Filter criteria
   * @returns Array of jobs
   */
  getJobsForServiceAccount(
    serviceAccountId: string,
    filters?: {
      status?: Job['status'];
      startDate?: string; // YYYY-MM-DD
      endDate?: string; // YYYY-MM-DD
      limit?: number;
      offset?: number;
    }
  ): Job[] {
    let results = Array.from(this.jobs.values())
      .filter(job => job.serviceAccountId === serviceAccountId);
    
    // Apply filters
    if (filters) {
      if (filters.status) {
        results = results.filter(job => job.status === filters.status);
      }
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        results = results.filter(job => 
          new Date(job.date) >= startDate
        );
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        results = results.filter(job => 
          new Date(job.date) <= endDate
        );
      }
    }
    
    // Sort by date (newest first)
    results.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Apply pagination
    if (filters?.offset !== undefined) {
      results = results.slice(filters.offset);
    }
    if (filters?.limit !== undefined) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  /**
   * Get upcoming jobs (for today and future)
   * @param limit - Maximum number of jobs to return
   * @returns Array of upcoming jobs
   */
  getUpcomingJobs(limit?: number): Job[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let results = Array.from(this.jobs.values())
      .filter(job => 
        job.status !== 'cancelled' && 
        job.status !== 'no_show' &&
        new Date(job.date) >= today
      );
    
    // Sort by date (soonest first)
    results.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    if (limit !== undefined) {
      results = results.slice(0, limit);
    }
    
    return results;
  }

  /**
   * Get jobs for today
   * @returns Array of jobs scheduled for today
   */
  getTodaysJobs(): Job[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    return Array.from(this.jobs.values())
      .filter(job => 
        job.status !== 'cancelled' && 
        job.status !== 'no_show' &&
        new Date(job.date) >= today &&
        new Date(job.date) < tomorrow
      )
      .sort((a, b) => 
        // Sort by time of day if we had time tracking, otherwise by ID
        a.id.localeCompare(b.id)
      );
  }

  /**
   * Complete a job and record payment
   * @param jobId - Job ID
   * @param paymentReceived - Whether payment was received
   * @returns Updated job
   */
  async completeJob(
    jobId: string, 
    paymentReceived: boolean = true
  ): Promise<Job> {
    const job = this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    // Update job status to completed
    const updatedJob = await this.updateJobStatus(jobId, 'completed');
    
    // If payment was received and not already paid, mark as paid
    if (paymentReceived && job.paymentStatus !== 'paid') {
      job.paymentStatus = 'paid';
      // In a real system, we'd process the payment here if not already done
      // For cash on arrival, payment might be collected after completion
    }
    
    this.jobs.set(jobId, job);
    
    // Log completion activity
    if (job.contactId) {
      this.crmService.logActivity({
        contactId: job.contactId,
        type: ActivityType.FOLLOW_UP,
        subject: `Job completed`,
        description: `Cleaning job completed successfully`,
        performedBy: 'system',
        performedAt: new Date(),
        isCompleted: true,
        nextStep: `Send review request and follow-up in 2 days`,
        nextStepDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      });
    }
    
    return job;
  }

  /**
   * Cancel a job
   * @param jobId - Job ID
   * @param reason - Reason for cancellation
   * @returns Updated job
   */
  cancelJob(jobId: string, reason: string = ''): Job {
    const job = this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const updatedJob = this.updateJobStatus(jobId, 'cancelled');
    
    // Log cancellation activity
    if (job.contactId) {
      this.crmService.logActivity({
        contactId: job.contactId,
        type: ActivityType.FOLLOW_UP,
        subject: `Job cancelled`,
        description: reason || `Job cancelled by customer or business`,
        performedBy: 'system',
        performedAt: new Date(),
        isCompleted: true
      });
    }
    
    return updatedJob;
  }

  /**
   * Mark job as no-show
   * @param jobId - Job ID
   * @returns Updated job
   */
  markNoShow(jobId: string): Job {
    const job = this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    const updatedJob = this.updateJobStatus(jobId, 'no_show');
    
    // Log no-show activity
    if (job.contactId) {
      this.crmService.logActivity({
        contactId: job.contactId,
        type: ActivityType.FOLLOW_UP,
        subject: `Customer no-show`,
        description: `Customer did not show up for scheduled job`,
        performedBy: 'system',
        performedAt: new Date(),
        isCompleted: true,
        nextStep: `Follow up with customer to reschedule`,
        nextStepDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
      });
    }
    
    return job;
  }

  /**
   * Generate a report for a service account
   * @param serviceAccountId - Service account ID
   * @returns Report summary
   */
  generateReport(serviceAccountId: string): Report {
    const serviceAccount = this.getServiceAccount(serviceAccountId);
    if (!serviceAccount) {
      throw new Error(`Service account ${serviceAccountId} not found`);
    }
    
    // Get the linked contact (if any)
    const contact = serviceAccount.contactId 
      ? this.crmService.getContact(serviceAccount.contactId) 
      : null;
    
    // Get upcoming jobs (next 5)
    const upcomingJobs = this.getJobsForServiceAccount(serviceAccountId, {
      status: 'scheduled',
      limit: 5
    }).map(job => ({
      id: job.id,
      date: job.date,
      duration: job.duration,
      address: job.address,
      status: job.status,
      assignedEmployee: job.assignedEmployee
    }));
    
    // Calculate total spent from subscription engine (for this service account)
    // In a real system, we'd have a way to link subscription payments to service accounts
    // For now, we'll use a placeholder or calculate from job payments
    const totalSpent = Array.from(this.jobs.values())
      .filter(job => job.serviceAccountId === serviceAccountId && job.paymentStatus === 'paid')
      .reduce((sum, job) => sum + (job.amount || 0), 0);
    
    // Calculate discount applied (from discount engine)
    // In a real system, we'd track discounts applied to specific jobs/service accounts
    // For now, we'll use a placeholder or calculate from job data
    const discountApplied = 0; // Placeholder
    
    return {
      clientId: serviceAccount.id,
      name: serviceAccount.name,
      totalSpent,
      discountApplied,
      upcomingAppointments: upcomingJobs,
      subscriptionTier: serviceAccount.subscriptionTier,
      lastActivity: serviceAccount.updatedAt
    };
  }

  /**
   * Get all vendors
   * @returns Array of vendor objects
   */
  getAllVendors(): Array<any> {
    return this.vendorManager.getAllVendors();
  }

  /**
   * Get vendor by ID
   * @param vendorId - Vendor ID
   * @returns Vendor object or null
   */
  getVendorById(vendorId: string): any | null {
    return this.vendorManager.getVendorById(vendorId);
  }

  /**
   * Add a new vendor
   * @param vendorData - Vendor information
   * @returns Created vendor object
   */
  addVendor(vendorData: any): any {
    return this.vendorManager.addVendor(vendorData);
  }

  /**
   * Get current inventory levels
   * @returns Array of inventory items with stock levels
   */
  getInventory(): Array<any> {
    return this.vendorManager.getInventory();
  }

  /**
   * Get inventory item by ID
   * @param itemId - Inventory item ID
   * @returns Inventory item or null
   */
  getInventoryItem(itemId: string): any | null {
    return this.vendorManager.getInventoryItem(itemId);
  }

  /**
   * Update inventory stock level (negative for usage, positive for restock)
   * @param itemId - Inventory item ID
   * @param quantityChange - Change in quantity
   * @returns Updated inventory item
   */
  updateInventoryStock(itemId: string, quantityChange: number): any | null {
    return this.vendorManager.updateInventoryStock(itemId, quantityChange);
  }

  /**
   * Get items that need reordering
   * @returns Array of inventory items needing reorder
   */
  getReorderList(): Array<any> {
    return this.vendorManager.getReorderList();
  }

  /**
   * Create a purchase order for reordering supplies
   * @param vendorId - Vendor ID
   * @param items - Array of items to order with quantities
   * @returns Purchase order object
   */
  createPurchaseOrder(vendorId: string, items: Array<{ itemId: string; quantity: number }>): any {
    return this.vendorManager.createPurchaseOrder(vendorId, items);
  }

  /**
   * Record usage of supplies for a job
   * @param jobId - Job ID
   * @param usage - Array of items used with quantities
   */
  recordSupplyUsage(jobId: string, usage: Array<{ itemId: string; quantity: number }>) {
    return this.vendorManager.recordSupplyUsage(jobId, usage);
  }
  
  /**
   * Get dashboard statistics for the business
   * @returns Business dashboard stats
   */
  getBusinessDashboardStats(): {
    totalServiceAccounts: number;
    activeServiceAccounts: number;
    totalJobs: number;
    completedJobs: number;
    cancelledJobs: number;
    noShowJobs: number;
    upcomingJobs: number;
    totalRevenue: number;
    averageJobValue: number;
    noShowRate: number;
  } {
    const serviceAccounts = Array.from(this.serviceAccounts.values());
    const jobs = Array.from(this.jobs.values());
    
    const totalServiceAccounts = serviceAccounts.length;
    const activeServiceAccounts = serviceAccounts.filter(sa => sa.status === 'active').length;
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const cancelledJobs = jobs.filter(j => j.status === 'cancelled').length;
    const noShowJobs = jobs.filter(j => j.status === 'no_show').length;
    const upcomingJobs = this.getUpcomingJobs().length;
    
    const totalRevenue = jobs
      .filter(j => j.paymentStatus === 'paid')
      .reduce((sum, j) => sum + (j.amount || 0), 0);
    
    const averageJobValue = completedJobs > 0
      ? totalRevenue / completedJobs
      : 0;
    
    const noShowRate = (completedJobs + cancelledJobs + noShowJobs) > 0
      ? (noShowJobs / (completedJobs + cancelledJobs + noShowJobs)) * 100
      : 0;
    
    return {
      totalServiceAccounts,
      activeServiceAccounts,
      totalJobs,
      completedJobs,
      cancelledJobs,
      noShowJobs,
      upcomingJobs,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      averageJobValue: parseFloat(averageJobValue.toFixed(2)),
      noShowRate: parseFloat(noShowRate.toFixed(2))
    };
  }
  
  /**
   * Get leads that need follow-up today
   * @returns Array of leads needing follow-up
   */
  getDueLeadFollowUps(): Array<{ lead: any; daysSinceLastContact: number }> {
    const leads = this.crmService.getLeads();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return leads
      .filter(lead => 
        lead.lastContactedAt && 
        lead.nextFollowUpAt && 
        lead.nextFollowUpAt <= today &&
        (lead.status === ContactStatus.LEAD || lead.status === ContactStatus.PROSPECT)
      )
      .map(lead => {
        const lastContacted = lead.lastContactedAt 
          ? new Date(lead.lastContactedAt) 
          : lead.createdAt;
        const daysSince = Math.ceil(
          (now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { lead, daysSinceLastContact: Math.max(0, daysSince) };
      })
      .sort((a, b) => a.daysSinceLastContact - b.daysSinceLastContact);
  }
  
  /**
   * Get clients that need follow-up today
   * @returns Array of clients needing follow-up
   */
  getDueClientFollowUps(): Array<{ contact: any; daysSinceLastContact: number }> {
    const contacts = this.crmService.getContacts({
      status: [ContactStatus.CLIENT, ContactStatus.FORMER_CLIENT]
    });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return contacts
      .filter(contact => 
        contact.lastContactedAt && 
        contact.nextFollowUpAt && 
        contact.nextFollowUpAt <= today
      )
      .map(contact => {
        const lastContacted = contact.lastContactedAt 
          ? new Date(contact.lastContactedAt) 
          : contact.createdAt;
        const daysSince = Math.ceil(
          (now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { contact, daysSinceLastContact: Math.max(0, daysSince) };
      })
      .sort((a, b) => a.daysSinceLastContact - b.daysSinceLastContact);
  }
  
  /**
   * Get service accounts that need follow-up today (based on linked contact)
   * @returns Array of service accounts needing follow-up
   */
  getDueServiceFollowUps(): Array<{ serviceAccount: ServiceAccount; contact: any; daysSinceLastContact: number }> {
    const serviceAccounts = this.getServiceAccounts({ status: 'active' });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return serviceAccounts
      .filter(sa => sa.contactId)
      .map(sa => {
        const contact = this.crmService.getContact(sa.contactId);
        if (!contact || !contact.lastContactedAt || !contact.nextFollowUpAt) {
          return null;
        }
        
        if (contact.nextFollowUpAt <= today) {
          const lastContacted = contact.lastContactedAt 
            ? new Date(contact.lastContactedAt) 
            : contact.createdAt;
          const daysSince = Math.ceil(
            (now.getTime() - lastContacted.getTime()) / (1000 * 60 * 60 * 24)
          );
          return { serviceAccount: sa, contact, daysSinceLastContact: Math.max(0, daysSince) };
        }
        return null;
      })
      .filter(Boolean) // Remove nulls
      .sort((a, b) => a.daysSinceLastContact - b.daysSinceLastContact);
  }
  
  /**
   * Generate a business-wide report
   * @returns Business report summary
   */
  generateBusinessReport(): {
    totalRevenue: number;
    totalClients: number;
    activeClients: number;
    newClientsThisMonth: number;
    totalJobsThisMonth: number;
    completedJobsThisMonth: number;
    revenueThisMonth: number;
    averageJobValue: number;
    noShowRate: number;
    clientRetentionRate: number;
    referralRate: number;
    upcomingJobs: number;
  } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const serviceAccounts = Array.from(this.serviceAccounts.values());
    const jobs = Array.from(this.jobs.values());
    const contacts = Array.from(this.crmService.getContacts().values());
    
    const totalClients = contacts.filter(c => c.status === ContactStatus.CLIENT).length;
    const activeClients = serviceAccounts.filter(sa => sa.status === 'active').length;
    
    const newClientsThisMonth = contacts.filter(c => 
      c.status === ContactStatus.CLIENT &&
      c.createdAt >= startOfMonth &&
      c.createdAt <= endOfMonth
    ).length;
    
    const totalJobsThisMonth = jobs.filter(j => 
      new Date(j.date) >= startOfMonth &&
      new Date(j.date) <= endOfMonth
    ).length;
    
    const completedJobsThisMonth = jobs.filter(j => 
      j.status === 'completed' &&
      new Date(j.date) >= startOfMonth &&
      new Date(j.date) <= endOfMonth
    ).length;
    
    const revenueThisMonth = jobs
      .filter(j => 
        j.paymentStatus === 'paid' &&
        new Date(j.date) >= startOfMonth &&
        new Date(j.date) <= endOfMonth
      )
      .reduce((sum, j) => sum + (j.amount || 0), 0);
    
    const averageJobValue = completedJobsThisMonth > 0
      ? revenueThisMonth / completedJobsThisMonth
      : 0;
    
    const totalJobsForNoShowRate = jobs
      .filter(j => 
        j.status !== 'cancelled' && 
        j.status !== 'no_show' &&
        new Date(j.date) >= startOfMonth &&
        new Date(j.date) <= endOfMonth
      ).length;
    
    const noShowJobsThisMonth = jobs.filter(j => 
      j.status === 'no_show' &&
      new Date(j.date) >= startOfMonth &&
      new Date(j.date) <= endOfMonth
    ).length;
    
    const noShowRate = totalJobsForNoShowRate > 0
      ? (noShowJobsThisMonth / totalJobsForNoShowRate) * 100
      : 0;
    
    // Client retention rate: percentage of clients who had a job in the last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const clientsWithJobLastMonth = new Set(
      jobs
        .filter(j => 
          j.status === 'completed' &&
          new Date(j.date) >= lastMonthStart &&
          new Date(j.date) <= lastMonthEnd
        )
        .map(j => j.contactId)
        .filter(id => id)
    );
    
    const totalClientsLastMonth = contacts
      .filter(c => 
        c.status === ContactStatus.CLIENT &&
        c.createdAt <= lastMonthEnd
      ).length;
    
    const clientRetentionRate = totalClientsLastMonth > 0
      ? (clientsWithJobLastMonth.size / totalClientsLastMonth) * 100
      : 0;
    
    // Referral rate: percentage of new clients that came from referrals
    const referredNewClients = contacts
      .filter(c => 
        c.status === ContactStatus.CLIENT &&
        c.createdAt >= startOfMonth &&
        c.createdAt <= endOfMonth &&
        c.leadSource === LeadSource.REFERRAL
      ).length;
    
    const referralRate = newClientsThisMonth > 0
      ? (referredNewClients / newClientsThisMonth) * 100
      : 0;
    
    const upcomingJobs = this.getUpcomingJobs().length;
    
    return {
      totalRevenue: parseFloat(
        jobs
          .filter(j => j.paymentStatus === 'paid')
          .reduce((sum, j) => sum + (j.amount || 0), 0)
          .toFixed(2)
      ),
      totalClients,
      activeClients,
      newClientsThisMonth,
      totalJobsThisMonth,
      completedJobsThisMonth,
      revenueThisMonth: parseFloat(revenueThisMonth.toFixed(2)),
      averageJobValue: parseFloat(averageJobValue.toFixed(2)),
      noShowRate: parseFloat(noShowRate.toFixed(2)),
      clientRetentionRate: parseFloat(clientRetentionRate.toFixed(2)),
      referralRate: parseFloat(referralRate.toFixed(2)),
      upcomingJobs
    };
  }
}

export default CleaningBusinessSystem;