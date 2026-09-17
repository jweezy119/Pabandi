import { v4 as uuidv4 } from 'uuid';
import { CleaningBusinessSystem } from '../businessSystem';
import { SubscriptionEngine } from '../subscriptionEngine';
import { DiscountEngine } from '../discountEngine';
import { ReportingService } from '../reportingService';

/**
 * Contact Status Enumeration
 */
export enum ContactStatus {
  LEAD = 'lead',
  PROSPECT = 'prospect',
  CLIENT = 'client',
  FORMER_CLIENT = 'former_client',
  ARCHIVED = 'archived'
}

/**
 * Lead Source Enumeration
 */
export enum LeadSource {
  REFERRAL = 'referral',
  WEBSITE = 'website',
  SOCIAL_MEDIA = 'social_media',
  GOOGLE_ADS = 'google_ads',
  FACEBOOK_ADS = 'facebook_ads',
  INSTAGRAM = 'instagram',
  YELP = 'yelp',
  ANGIES_LIST = 'angies_list',
  HOME_ADVISOR = 'home_advisor',
  THUMBTACK = 'thumtack',
  NEXTDOOR = 'nextdoor',
  LOCAL_SEO = 'local_seo',
  DIRECT_MAIL = 'direct_mail',
  EVENT = 'event',
  PARTNER = 'partner',
  OTHER = 'other'
}

/**
 * Pipeline Stage Enumeration
 */
export enum PipelineStage {
  NEW_LEAD = 'new_lead',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL_SENT = 'proposal_sent',
  NEGOTIATION = 'negotiation',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost'
}

/**
 * Activity Type Enumeration
 */
export enum ActivityType {
  CALL = 'call',
  EMAIL = 'email',
  SMS = 'sms',
  MEETING = 'meeting',
  FOLLOW_UP = 'follow_up',
  SERVICE_REMINDER = 'service_reminder',
  INVOICE_SENT = 'invoice_sent',
  PAYMENT_RECEIVED = 'payment_received',
  REVIEW_REQUEST = 'review_request',
  REVIEW_RECEIVED = 'review_received',
  OTHER = 'other'
}

/**
 * Contact/Client Interface
 */
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  status: ContactStatus;
  leadSource?: LeadSource;
  pipelineStage?: PipelineStage;
  assignedTo?: string; // Employee ID
  tags?: string[];
  notes?: string[];
  customFields?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt?: Date;
  totalValue?: number; // Total lifetime value
  jobCount?: number; // Number of jobs completed
  lastJobAt?: Date;
  nextFollowUpAt?: Date;
  followUpFrequency?: number; // Days between follow-ups
}

/**
 * Lead Interface (simplified contact for pipeline)
 */
export interface Lead extends Omit<Contact, 'status' | 'pipelineStage'> {
  status: ContactStatus.LEAD | ContactStatus.PROSPECT;
  pipelineStage: PipelineStage;
  estimatedValue?: number;
  probability?: number; // 0-100
  expectedCloseDate?: Date;
}

/**
 * Activity/Interaction Interface
 */
export interface Activity {
  id: string;
  contactId: string;
  type: ActivityType;
  subject: string;
  description?: string;
  performedBy: string; // Employee ID
  performedAt: Date;
  relatedTo?: string; // Could be job ID, invoice ID, etc.
  outcome?: string; // Result of the activity
  nextStep?: string; // Suggested next action
  nextStepDate?: Date;
  isCompleted: boolean;
  metadata?: Record<string, any>;
}

/**
 * Note Interface (for client history)
 */
export interface Note {
  id: string;
  contactId: string;
  title: string;
  content: string;
  createdBy: string; // Employee ID
  createdAt: Date;
  isPinned: boolean;
  tags?: string[];
}

/**
 * CRM Service Main Class
 */
export class CRMService {
  private contacts: Map<string, Contact> = new Map();
  private activities: Map<string, Activity> = new Map();
  private notes: Map<string, Note> = new Map();
  private leads: Map<string, Lead> = new Map(); // Separate for quick pipeline access
  
  // Dependencies
  private subscriptionEngine: SubscriptionEngine;
  private discountEngine: DiscountEngine;
  private reportingService: ReportingService;
  
  // Configuration
  private followUpRules: {
    [key in ContactStatus]: number; // Days between follow-ups
  } = {
    [ContactStatus.LEAD]: 3,
    [ContactStatus.PROSPECT]: 7,
    [ContactStatus.CLIENT]: 30,
    [ContactStatus.FORMER_CLIENT]: 90,
    [ContactStatus.ARCHIVED]: 365
  };
  
  constructor() {
    this.subscriptionEngine = new SubscriptionEngine();
    this.discountEngine = new DiscountEngine();
    this.reportingService = new ReportingService();
    
    // Load any existing data from storage (in production, this would come from a database)
    this.loadInitialData();
  }
  
  /**
   * Load initial data (in production, replace with database call)
   */
  private loadInitialData(): void {
    // For demo purposes, we'll start with empty data
    // In a real app, this would load from localStorage, IndexedDB, or an API
    console.log('📥 CRM Service initialized with empty dataset');
  }
  
  /**
   * Create a new contact
   * @param contactData - Contact information
   * @returns Created contact
   */
  createContact(contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Contact {
    const now = new Date();
    const contact: Contact = {
      id: uuidv4(),
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      email: contactData.email,
      phone: contactData.phone,
      address: contactData.address,
      city: contactData.city,
      state: contactData.state,
      zipCode: contactData.zipCode,
      status: contactData.status || ContactStatus.LEAD,
      leadSource: contactData.leadSource,
      pipelineStage: contactData.pipelineStage,
      assignedTo: contactData.assignedTo,
      tags: contactData.tags || [],
      notes: contactData.notes || [],
      customFields: contactData.customFields || {},
      createdAt: now,
      updatedAt: now,
      lastContactedAt: contactData.lastContactedAt,
      totalValue: contactData.totalValue || 0,
      jobCount: contactData.jobCount || 0,
      lastJobAt: contactData.lastJobAt,
      nextFollowUpAt: this.calculateNextFollowUpDate(contactData.status || ContactStatus.LEAD),
      followUpFrequency: contactData.followUpFrequency || this.followUpRules[contactData.status || ContactStatus.LEAD]
    };
    
    this.contacts.set(contact.id, contact);
    
    // If it's a lead, also add to leads map for quick pipeline access
    if (contact.status === ContactStatus.LEAD || contact.status === ContactStatus.PROSPECT) {
      const lead: Lead = {
        ...contact,
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zipCode: contact.zipCode,
        status: contact.status,
        leadSource: contact.leadSource,
        pipelineStage: contact.pipelineStage || PipelineStage.NEW_LEAD,
        assignedTo: contact.assignedTo,
        tags: contact.tags,
        notes: contact.notes,
        customFields: contact.customFields,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        lastContactedAt: contact.lastContactedAt,
        totalValue: contact.totalValue,
        jobCount: contact.jobCount,
        lastJobAt: contact.lastJobAt,
        nextFollowUpAt: contact.nextFollowUpAt,
        followUpFrequency: contact.followUpFrequency,
        estimatedValue: contactData.estimatedValue,
        probability: contactData.probability,
        expectedCloseDate: contactData.expectedCloseDate
      };
      this.leads.set(lead.id, lead);
    }
    
    console.log(`✅ Created contact: ${contact.firstName} ${contact.lastName} (${contact.id})`);
    return contact;
  }
  
  /**
   * Get contact by ID
   * @param contactId - Contact ID
   * @returns Contact or null if not found
   */
  getContact(contactId: string): Contact | null {
    return this.contacts.get(contactId) || null;
  }
  
  /**
   * Update contact
   * @param contactId - Contact ID
   * @param updates - Partial contact updates
   * @returns Updated contact or null if not found
   */
  updateContact(contactId: string, updates: Partial<Omit<Contact, 'id' | 'createdAt'>>): Contact | null {
    const contact = this.contacts.get(contactId);
    if (!contact) return null;
    
    const updatedContact: Contact = {
      ...contact,
      ...updates,
      updatedAt: new Date()
    };
    
    // Update next follow-up date if status changed
    if (updates.status && updates.status !== contact.status) {
      updatedContact.nextFollowUpAt = this.calculateNextFollowUpDate(updates.status);
      updatedContact.followUpFrequency = this.followUpRules[updates.status];
    }
    
    // Handle status transitions between lead/prospect/client
    const oldStatus = contact.status;
    const newStatus = updatedContact.status;
    
    // If moving from lead/prospect to client or vice versa, update leads map
    if ((oldStatus === ContactStatus.LEAD || oldStatus === ContactStatus.PROSPECT) && 
        !(newStatus === ContactStatus.LEAD || newStatus === ContactStatus.PROSPECT)) {
      // Removing from leads
      this.leads.delete(contactId);
    } else if (!(oldStatus === ContactStatus.LEAD || oldStatus === ContactStatus.PROSPECT) && 
               (newStatus === ContactStatus.LEAD || newStatus === ContactStatus.PROSPECT)) {
      // Adding to leads
      const lead: Lead = {
        ...updatedContact,
        id: updatedContact.id,
        firstName: updatedContact.firstName,
        lastName: updatedContact.lastName,
        email: updatedContact.email,
        phone: updatedContact.phone,
        address: updatedContact.address,
        city: updatedContact.city,
        state: updatedContact.state,
        zipCode: updatedContact.zipCode,
        status: updatedContact.status,
        leadSource: updatedContact.leadSource,
        pipelineStage: updatedContact.pipelineStage || PipelineStage.NEW_LEAD,
        assignedTo: updatedContact.assignedTo,
        tags: updatedContact.tags,
        notes: updatedContact.notes,
        customFields: updatedContact.customFields,
        createdAt: updatedContact.createdAt,
        updatedAt: updatedContact.updatedAt,
        lastContactedAt: updatedContact.lastContactedAt,
        totalValue: updatedContact.totalValue,
        jobCount: updatedContact.jobCount,
        lastJobAt: updatedContact.lastJobAt,
        nextFollowUpAt: updatedContact.nextFollowUpAt,
        followUpFrequency: updatedContact.followUpFrequency,
        estimatedValue: undefined,
        probability: undefined,
        expectedCloseDate: undefined
      };
      this.leads.set(lead.id, lead);
    }
    
    // If already in leads and status is still lead/prospect, update the lead
    if ((newStatus === ContactStatus.LEAD || newStatus === ContactStatus.PROSPECT) && 
        this.leads.has(contactId)) {
      const leadUpdate: Partial<Lead> = {
        ...updates,
        updatedAt: new Date()
      };
      
      // Handle pipeline stage changes
      if (updates.pipelineStage) {
        leadUpdate.pipelineStage = updates.pipelineStage;
      }
      
      const existingLead = this.leads.get(contactId)!;
      const updatedLead: Lead = {
        ...existingLead,
        ...leadUpdate
      };
      this.leads.set(contactId, updatedLead);
    }
    
    this.contacts.set(contactId, updatedContact);
    
    // Log activity for significant changes
    if (updates.status || updates.pipelineStage || updates.assignedTo) {
      this.logActivity({
        contactId,
        type: ActivityType.FOLLOW_UP,
        subject: `Contact updated`,
        description: `Status changed from ${oldStatus} to ${newStatus}. ${updates.assignedTo ? `Reassigned to employee ${updates.assignedTo}` : ''}`,
        performedBy: 'system', // In real app, this would be the current user
        performedAt: new Date(),
        isCompleted: true
      });
    }
    
    console.log(`✅ Updated contact: ${updatedContact.firstName} ${updatedContact.lastName} (${contactId})`);
    return updatedContact;
  }
  
  /**
   * Delete contact (soft delete by archiving)
   * @param contactId - Contact ID
   * @returns Boolean indicating success
   */
  deleteContact(contactId: string): boolean {
    const contact = this.contacts.get(contactId);
    if (!contact) return false;
    
    // Archive instead of hard delete
    return !!this.updateContact(contactId, {
      status: ContactStatus.ARCHIVED,
      notes: [...(contact.notes || []), `Archived on ${new Date().toISOString().split('T')[0]}`]
    });
  }
  
  /**
   * Get all contacts with optional filtering
   * @param filters - Filter criteria
   * @returns Array of contacts
   */
  getContacts(filters?: {
    status?: ContactStatus | ContactStatus[];
    leadSource?: LeadSource | LeadSource[];
    assignedTo?: string | string[];
    tags?: string | string[];
    pipelineStage?: PipelineStage | PipelineStage[];
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Contact[] {
    let results = Array.from(this.contacts.values());
    
    // Apply filters
    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        results = results.filter(contact => statuses.includes(contact.status));
      }
      
      if (filters.leadSource) {
        const sources = Array.isArray(filters.leadSource) ? filters.leadSource : [filters.leadSource];
        results = results.filter(contact => contact.leadSource && sources.includes(contact.leadSource));
      }
      
      if (filters.assignedTo) {
        const assignees = Array.isArray(filters.assignedTo) ? filters.assignedTo : [filters.assignedTo];
        results = results.filter(contact => contact.assignedTo && assignees.includes(contact.assignedTo));
      }
      
      if (filters.tags) {
        const tagList = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
        results = results.filter(contact => 
          contact.tags && contact.tags.some(tag => tagList.includes(tag))
        );
      }
      
      if (filters.pipelineStage) {
        const stages = Array.isArray(filters.pipelineStage) ? filters.pipelineStage : [filters.pipelineStage];
        results = results.filter(contact => 
          contact.pipelineStage && stages.includes(contact.pipelineStage)
        );
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(contact => 
          contact.firstName.toLowerCase().includes(term) ||
          contact.lastName.toLowerCase().includes(term) ||
          (contact.email || '').toLowerCase().includes(term) ||
          (contact.phone || '').toLowerCase().includes(term) ||
          (contact.address || '').toLowerCase().includes(term) ||
          (contact.city || '').toLowerCase().includes(term) ||
          (contact.state || '').toLowerCase().includes(term) ||
          (contact.zipCode || '').toLowerCase().includes(term) ||
          (contact.notes || []).some(note => note.toLowerCase().includes(term))
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
   * Get leads for pipeline view
   * @param filters - Filter criteria
   * @returns Array of leads
   */
  getLeads(filters?: {
    pipelineStage?: PipelineStage | PipelineStage[];
    assignedTo?: string | string[];
    leadSource?: LeadSource | LeadSource[];
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Lead[] {
    let results = Array.from(this.leads.values());
    
    // Apply filters
    if (filters) {
      if (filters.pipelineStage) {
        const stages = Array.isArray(filters.pipelineStage) ? filters.pipelineStage : [filters.pipelineStage];
        results = results.filter(lead => stages.includes(lead.pipelineStage));
      }
      
      if (filters.assignedTo) {
        const assignees = Array.isArray(filters.assignedTo) ? filters.assignedTo : [filters.assignedTo];
        results = results.filter(lead => lead.assignedTo && assignees.includes(lead.assignedTo));
      }
      
      if (filters.leadSource) {
        const sources = Array.isArray(filters.leadSource) ? filters.leadSource : [filters.leadSource];
        results = results.filter(lead => lead.leadSource && sources.includes(lead.leadSource));
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(lead => 
          lead.firstName.toLowerCase().includes(term) ||
          lead.lastName.toLowerCase().includes(term) ||
          (lead.email || '').toLowerCase().includes(term) ||
          (lead.phone || '').toLowerCase().includes(term)
        );
      }
    }
    
    // Sort by pipeline stage (newest first) then by expected close date
    results.sort((a, b) => {
      // First sort by pipeline stage (earlier in pipeline = higher priority)
      const stageOrder: PipelineStage[] = [
        PipelineStage.NEW_LEAD,
        PipelineStage.CONTACTED,
        PipelineStage.QUALIFIED,
        PipelineStage.PROPOSAL_SENT,
        PipelineStage.NEGOTIATION,
        PipelineStage.CLOSED_WON,
        PipelineStage.CLOSED_LOST
      ];
      
      const stageA = stageOrder.indexOf(a.pipelineStage);
      const stageB = stageOrder.indexOf(b.pipelineStage);
      
      if (stageA !== stageB) {
        return stageA - stageB;
      }
      
      // Then sort by expected close date (soonest first)
      const dateA = a.expectedCloseDate ? a.expectedCloseDate.getTime() : Infinity;
      const dateB = b.expectedCloseDate ? b.expectedCloseDate.getTime() : Infinity;
      return dateA - dateB;
    });
    
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
   * Log an activity/interaction with a contact
   * @param activityData - Activity information
   * @returns Created activity
   */
  logActivity(activityData: Omit<Activity, 'id' | 'performedAt' | 'isCompleted'>): Activity {
    const now = new Date();
    const activity: Activity = {
      id: uuidv4(),
      contactId: activityData.contactId,
      type: activityData.type,
      subject: activityData.subject,
      description: activityData.description,
      performedBy: activityData.performedBy,
      performedAt: now,
      relatedTo: activityData.relatedTo,
      outcome: activityData.outcome,
      nextStep: activityData.nextStep,
      nextStepDate: activityData.nextStepDate,
      isCompleted: activityData.isCompleted ?? false,
      metadata: activityData.metadata || {}
    };
    
    this.activities.set(activity.id, activity);
    
    // Update contact's last contacted time
    const contact = this.contacts.get(activityData.contactId);
    if (contact) {
      this.updateContact(contact.id, {
        lastContactedAt: now,
        nextFollowUpAt: this.calculateNextFollowUpDate(contact.status, activityData.nextStepDate)
      });
    }
    
    console.log(`📝 Logged activity: ${activity.type} for contact ${activity.contactId}`);
    return activity;
  }
  
  /**
   * Get activities for a contact
   * @param contactId - Contact ID
   * @param filters - Filter criteria
   * @returns Array of activities
   */
  getContactActivities(contactId: string, filters?: {
    type?: ActivityType | ActivityType[];
    startDate?: Date;
    endDate?: Date;
    performedBy?: string | string[];
    limit?: number;
    offset?: number;
  }): Activity[] {
    const contactActivities = Array.from(this.activities.values())
      .filter(activity => activity.contactId === contactId);
    
    // Apply filters
    if (filters) {
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        contactActivities.filter(activity => types.includes(activity.type));
      }
      
      if (filters.startDate) {
        contactActivities.filter(activity => activity.performedAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        contactActivities.filter(activity => activity.performedAt <= filters.endDate!);
      }
      
      if (filters.performedBy) {
        const performers = Array.isArray(filters.performedBy) ? filters.performedBy : [filters.performedBy];
        contactActivities.filter(activity => performers.includes(activity.performedBy));
      }
    }
    
    // Sort by most recent first
    contactActivities.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
    
    // Apply pagination
    if (filters?.offset !== undefined) {
      contactActivities.slice(filters.offset);
    }
    if (filters?.limit !== undefined) {
      contactActivities.slice(0, filters.limit);
    }
    
    return contactActivities;
  }
  
  /**
   * Add a note to a contact's history
   * @param noteData - Note information
   * @returns Created note
   */
  addNote(noteData: Omit<Note, 'id' | 'createdAt'>): Note {
    const now = new Date();
    const note: Note = {
      id: uuidv4(),
      contactId: noteData.contactId,
      title: noteData.title,
      content: noteData.content,
      createdBy: noteData.createdBy,
      createdAt: now,
      isPinned: noteData.isPinned ?? false,
      tags: noteData.tags || []
    };
    
    this.notes.set(note.id, note);
    
    // Also add to contact's notes array
    const contact = this.contacts.get(noteData.contactId);
    if (contact) {
      this.updateContact(contact.id, {
        notes: [...(contact.notes || []), note.id]
      });
    }
    
    console.log(`📌 Added note: "${note.title}" for contact ${note.contactId}`);
    return note;
  }
  
  /**
   * Get notes for a contact
   * @param contactId - Contact ID
   * @param filters - Filter criteria
   * @returns Array of notes
   */
  getContactNotes(contactId: string, filters?: {
    isPinned?: boolean;
    tags?: string | string[];
    limit?: number;
    offset?: number;
  }): Note[] {
    let results = Array.from(this.notes.values())
      .filter(note => note.contactId === contactId);
    
    // Apply filters
    if (filters) {
      if (filters.isPinned !== undefined) {
        results = results.filter(note => note.isPinned === filters.isPinned);
      }
      
      if (filters.tags) {
        const tagList = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
        results = results.filter(note => 
          note.tags && note.tags.some(tag => tagList.includes(tag))
        );
      }
    }
    
    // Sort by pinned first, then most recent
    results.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
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
   * Calculate next follow-up date based on contact status and optional override
   * @param status - Contact status
   * @param overrideDate - Optional specific date for next follow-up
   * @returns Date for next follow-up
   */
  calculateNextFollowUpDate(status: ContactStatus, overrideDate?: Date): Date {
    if (overrideDate) {
      return overrideDate;
    }
    
    const now = new Date();
    const daysToAdd = this.followUpRules[status] || 30;
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysToAdd);
    return nextDate;
  }
  
  /**
   * Get contacts that need follow-up today
   * @returns Array of contacts needing follow-up
   */
  getDueFollowUps(): Contact[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return Array.from(this.contacts.values())
      .filter(contact => 
        contact.nextFollowUpAt && 
        contact.nextFollowUpAt <= today &&
        contact.status !== ContactStatus.ARCHIVED
      )
      .sort((a, b) => 
        (a.nextFollowUpAt?.getTime() || 0) - (b.nextFollowUpAt?.getTime() || 0)
      );
  }
  
  /**
   * Get pipeline summary statistics
   * @returns Pipeline summary object
   */
  getPipelineSummary(): {
    totalLeads: number;
    byStage: Record<PipelineStage, number>;
    bySource: Record<LeadSource, number>;
    totalEstimatedValue: number;
    weightedValue: number;
    conversionRate: number;
    avgDaysInPipeline: number;
  } {
    const leads = Array.from(this.leads.values());
    const totalLeads = leads.length;
    
    // Count by stage
    const byStage: Record<PipelineStage, number> = {};
    Object.values(PipelineStage).forEach(stage => {
      byStage[stage] = leads.filter(lead => lead.pipelineStage === stage).length;
    });
    
    // Count by source
    const bySource: Record<LeadSource, number> = {};
    Object.values(LeadSource).forEach(source => {
      bySource[source] = leads.filter(lead => lead.leadSource === source).length;
    });
    
    // Calculate estimated value
    const totalEstimatedValue = leads.reduce((sum, lead) => 
      sum + (lead.estimatedValue || 0), 0);
    
    // Calculate weighted value (estimated value * probability)
    const weightedValue = leads.reduce((sum, lead) => 
      sum + ((lead.estimatedValue || 0) * (lead.probability || 0) / 100), 0);
    
    // Calculate conversion rate (won / (won + lost))
    const wonLeads = leads.filter(lead => lead.pipelineStage === PipelineStage.CLOSED_WON).length;
    const lostLeads = leads.filter(lead => lead.pipelineStage === PipelineStage.CLOSED_LOST).length;
    const conversionRate = (wonLeads + lostLeads) > 0 
      ? (wonLeads / (wonLeads + lostLeads)) * 100 
      : 0;
    
    // Calculate average days in pipeline (for active leads)
    const activeLeads = leads.filter(lead => 
      lead.pipelineStage !== PipelineStage.CLOSED_WON && 
      lead.pipelineStage !== PipelineStage.CLOSED_LOST
    );
    
    const avgDaysInPipeline = activeLeads.length > 0
      ? activeLeads.reduce((sum, lead) => {
          const daysOld = (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + daysOld;
        }, 0) / activeLeads.length
      : 0;
    
    return {
      totalLeads,
      byStage,
      bySource,
      totalEstimatedValue,
      weightedValue,
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      avgDaysInPipeline: parseFloat(avgDaysInPipeline.toFixed(1))
    };
  }
  
  /**
   * Get dashboard statistics for CRM
   * @returns CRM dashboard stats
   */
  getCRMDashboardStats(): {
    totalContacts: number;
    byStatus: Record<ContactStatus, number>;
    newLeadsToday: number;
    dueFollowUps: number;
    totalValue: number;
    avgContactValue: number;
    conversionRate: number;
  } {
    const contacts = Array.from(this.contacts.values());
    const totalContacts = contacts.length;
    
    // Count by status
    const byStatus: Record<ContactStatus, number> = {};
    Object.values(ContactStatus).forEach(status => {
      byStatus[status] = contacts.filter(contact => contact.status === status).length;
    });
    
    // Count new leads today (created today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const newLeadsToday = contacts.filter(contact => 
      contact.createdAt >= today && 
      contact.createdAt < tomorrow &&
      (contact.status === ContactStatus.LEAD || contact.status === ContactStatus.PROSPECT)
    ).length;
    
    // Count due follow-ups
    const dueFollowUps = this.getDueFollowUps().length;
    
    // Calculate total value (lifetime value of all clients)
    const totalValue = contacts.reduce((sum, contact) => 
      sum + (contact.totalValue || 0), 0);
    
    // Calculate average contact value (only for clients)
    const clientContacts = contacts.filter(contact => contact.status === ContactStatus.CLIENT);
    const avgContactValue = clientContacts.length > 0
      ? totalValue / clientContacts.length
      : 0;
    
    // Get conversion rate from pipeline
    const pipelineSummary = this.getPipelineSummary();
    
    return {
      totalContacts,
      byStatus,
      newLeadsToday,
      dueFollowUps,
      totalValue: parseFloat(totalValue.toFixed(2)),
      avgContactValue: parseFloat(avgContactValue.toFixed(2)),
      conversionRate: pipelineSummary.conversionRate
    };
  }
  
  /**
   * Automatically create follow-up activities based on rules
   * @returns Number of follow-up activities created
   */
  autoCreateFollowUps(): number {
    const dueContacts = this.getDueFollowUps();
    let createdCount = 0;
    
    for (const contact of dueContacts) {
      // Skip if already has a pending follow-up activity for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const hasPendingFollowUp = Array.from(this.activities.values())
        .some(activity => 
          activity.contactId === contact.id &&
          activity.type === ActivityType.FOLLOW_UP &&
          !activity.isCompleted &&
          activity.performedAt >= today &&
          activity.performedAt < tomorrow
        );
      
      if (!hasPendingFollowUp) {
        // Create follow-up activity
        this.logActivity({
          contactId: contact.id,
          type: ActivityType.FOLLOW_UP,
          subject: `Follow-up for ${contact.firstName} ${contact.lastName}`,
          description: `Scheduled follow-up based on ${contact.status} status`,
          performedBy: 'system', // In real app, this would be assigned to the contact's owner or a queue
          performedAt: new Date(),
          nextStep: `Contact ${contact.firstName} to check satisfaction and discuss next services`,
          nextStepDate: this.calculateNextFollowUpDate(contact.status),
          isCompleted: false
        });
        
        // Update contact's next follow-up date
        this.updateContact(contact.id, {
          nextFollowUpAt: this.calculateNextFollowUpDate(contact.status),
          lastContactedAt: new Date()
        });
        
        createdCount++;
      }
    }
    
    if (createdCount > 0) {
      console.log(`🔄 Auto-created ${createdCount} follow-up activities`);
    }
    
    return createdCount;
  }
  
  /**
   * Export contacts to CSV format (for backup or migration)
   * @returns CSV string
   */
  exportContactsToCSV(): string {
    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Address',
      'City',
      'State',
      'ZIP Code',
      'Status',
      'Lead Source',
      'Pipeline Stage',
      'Assigned To',
      'Tags',
      'Total Value',
      'Job Count',
      'Last Job At',
      'Created At',
      'Updated At',
      'Last Contacted At',
      'Next Follow-Up At',
      'Follow-Up Frequency (days)'
    ];
    
    const rows = Array.from(this.contacts.values()).map(contact => [
      contact.id,
      `"${contact.firstName.replace(/"/g, '""')}"`,
      `"${contact.lastName.replace(/"/g, '""')}"`,
      contact.email ? `"${contact.email.replace(/"/g, '""')}"` : '',
      contact.phone ? `"${contact.phone.replace(/"/g, '""')}"` : '',
      contact.address ? `"${contact.address.replace(/"/g, '""')}"` : '',
      contact.city ? `"${contact.city.replace(/"/g, '""')}"` : '',
      contact.state ? `"${contact.state.replace(/"/g, '""')}"` : '',
      contact.zipCode ? `"${contact.zipCode.replace(/"/g, '""')}"` : '',
      contact.status,
      contact.leadSource || '',
      contact.pipelineStage || '',
      contact.assignedTo || '',
      (contact.tags || []).join('; '),
      contact.totalValue || 0,
      contact.jobCount || 0,
      contact.lastJobAt ? contact.lastJobAt.toISOString() : '',
      contact.createdAt.toISOString(),
      contact.updatedAt.toISOString(),
      contact.lastContactedAt ? contact.lastContactedAt.toISOString() : '',
      contact.nextFollowUpAt ? contact.nextFollowUpAt.toISOString() : '',
      contact.followUpFrequency || 0
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
  
  /**
   * Import contacts from CSV format
   * @param csvData - CSV string
   * @returns Number of contacts imported
   */
  importContactsFromCSV(csvData: string): number {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return 0; // Need at least header and one data row
    
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);
    
    let importedCount = 0;
    
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      try {
        const values = line.split(',');
        const contactData: any = {};
        
        headers.forEach((header, index) => {
          let value = values[index]?.trim() || '';
          
          // Handle quoted values
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1).replace(/'/g, "'");
          }
          
          // Map to appropriate field type
          switch (header) {
            case 'ID':
              contactData.id = value;
              break;
            case 'First Name':
              contactData.firstName = value;
              break;
            case 'Last Name':
              contactData.lastName = value;
              break;
            case 'Email':
              contactData.email = value || undefined;
              break;
            case 'Phone':
              contactData.phone = value || undefined;
              break;
            case 'Address':
              contactData.address = value || undefined;
              break;
            case 'City':
              contactData.city = value || undefined;
              break;
            case 'State':
              contactData.state = value || undefined;
              break;
            case 'ZIP Code':
              contactData.zipCode = value || undefined;
              break;
            case 'Status':
              contactData.status = value as ContactStatus || ContactStatus.LEAD;
              break;
            case 'Lead Source':
              contactData.leadSource = value as LeadSource || undefined;
              break;
            case 'Pipeline Stage':
              contactData.pipelineStage = value as PipelineStage || undefined;
              break;
            case 'Assigned To':
              contactData.assignedTo = value || undefined;
              break;
            case 'Tags':
              contactData.tags = value ? value.split(';').map(t => t.trim()).filter(t => t.length > 0) : undefined;
              break;
            case 'Total Value':
              contactData.totalValue = parseFloat(value) || 0;
              break;
            case 'Job Count':
              contactData.jobCount = parseInt(value) || 0;
              break;
            case 'Last Job At':
              contactData.lastJobAt = value ? new Date(value) : undefined;
              break;
            case 'Created At':
              contactData.createdAt = value ? new Date(value) : new Date();
              break;
            case 'Updated At':
              contactData.updatedAt = value ? new Date(value) : new Date();
              break;
            case 'Last Contacted At':
              contactData.lastContactedAt = value ? new Date(value) : undefined;
              break;
            case 'Next Follow-Up At':
              contactData.nextFollowUpAt = value ? new Date(value) : undefined;
              break;
            case 'Follow-Up Frequency (days)':
              contactData.followUpFrequency = parseInt(value) || undefined;
              break;
          }
        });
        
        // Validate required fields
        if (!contactData.firstName || !contactData.lastName) {
          console.warn(`Skipping contact with missing name: ${JSON.stringify(contactData)}`);
          return importedCount;
        }
        
        // Create the contact (this will handle deduplication by ID if needed)
        // Check if contact already exists
        if (this.contacts.has(contactData.id)) {
          console.log(`Contact ${contactData.id} already exists, updating...`);
          this.updateContact(contactData.id, contactData);
        } else {
          this.createContact(contactData);
        }
        
        importedCount++;
      } catch (error) {
        console.error(`Error importing contact from line: ${line}`, error);
        // Continue with next line
      }
    }
    
    console.log(`📥 Imported ${importedCount} contacts from CSV`);
    return importedCount;
  }
}

export default CRMService;