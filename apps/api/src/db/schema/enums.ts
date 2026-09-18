import { pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
  'archived',
  'paused',
  'cancelled',
  'inactive',
]);
export const tenantTypeEnum = pgEnum('tenant_type', ['franchisor', 'franchisee', 'independent']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'inactive']);
export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'hot',
  'junk',
  'active',
  'converted',
  'lost',
]);
export const partyTypeEnum = pgEnum('party_type', ['individual', 'organization']);
export const partySourceEnum = pgEnum('party_source', [
  'manual',
  'csv_import',
  'meta_ad',
  'google_ad',
  'website_webhook',
  'justdial',
  'whatsapp',
  'referral',
  'api',
]);
export const partyMergeStatusEnum = pgEnum('party_merge_status', ['canonical', 'merged', 'pending_review']);
export const interactionChannelEnum = pgEnum('interaction_channel', ['whatsapp', 'email', 'phone', 'sms', 'system', 'note']);
export const interactionDirectionEnum = pgEnum('interaction_direction', ['inbound', 'outbound']);
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'completed', 'cancelled', 'no_show']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'issued', 'paid', 'overdue', 'cancelled']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partially_paid', 'paid', 'refunded']);
export const propertyStatusEnum = pgEnum('property_status', ['available', 'reserved', 'sold', 'leased']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'completed', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'probation', 'notice_period', 'resigned', 'terminated']);
export const leaveStatusEnum = pgEnum('leave_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const connectionStatusEnum = pgEnum('connection_status', ['disconnected', 'connected', 'error']);
export const inboundEventStatusEnum = pgEnum('inbound_event_status', [
  'received',
  'deduplicated',
  'processing',
  'routed',
  'failed',
  'dead_lettered',
]);
