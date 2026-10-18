/**
 * Notification Rules & Conditions Specification
 *
 * Defines the comprehensive trigger rules, timing, priority, and conditions
 * for all notification types in DriveLedger.
 */

export interface NotificationRuleInfo {
  id: string;
  name: string;
  category: 'Document' | 'Service' | 'Fuel' | 'Summary';
  channelId: 'document-expiry' | 'service-due' | 'general-reminders';
  channelName: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timing: string;
  conditionDescription: string;
  exampleTitle: string;
  exampleBody: string;
}

export const NOTIFICATION_RULES: NotificationRuleInfo[] = [
  {
    id: 'puc_expired',
    name: 'PUC Expired (Urgent Legal Fine)',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'CRITICAL',
    timing: 'Immediately when expired (days < 0), re-checked on app launch',
    conditionDescription:
      'Active PUC document where expiry_date < today. Warns user about the direct ₹10,000 fine under Section 190(2) of the Motor Vehicles Act.',
    exampleTitle: '🚨 PUC Expired! Immediate ₹10,000 Fine Risk',
    exampleBody:
      'PUC certificate for White Swift expired 4 days ago. Renew immediately at any petrol pump to avoid heavy fines under Sec 190(2).',
  },
  {
    id: 'puc_1day',
    name: 'PUC Expires Tomorrow',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'CRITICAL',
    timing: 'Exactly 1 day before expiration (days === 1)',
    conditionDescription:
      'Active PUC document expiring tomorrow. Emphasizes that petrol pump testing only takes ~5 minutes.',
    exampleTitle: '🚨 PUC Expires Tomorrow! (Avoid ₹10,000 Fine)',
    exampleBody:
      'Your Pollution Under Control certificate for White Swift expires tomorrow. Most testing centers take only 5 minutes.',
  },
  {
    id: 'puc_7days',
    name: 'PUC Expiring in ≤ 7 Days',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'HIGH',
    timing: 'Between 2 and 7 days remaining (2 <= days <= 7)',
    conditionDescription:
      'Active PUC document within 1 week of lapsing. Alerts driver to renew during upcoming errands or fuel runs.',
    exampleTitle: '⚠️ PUC Expiring in 4 days',
    exampleBody:
      'PUC for White Swift expires in 4 days. Avoid heavy fines under the Motor Vehicles Act by renewing soon.',
  },
  {
    id: 'puc_15days',
    name: 'PUC Renewal Window Open (15 Days)',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'MEDIUM',
    timing: 'Between 8 and 15 days remaining (8 <= days <= 15)',
    conditionDescription:
      'Active PUC document enters early renewal window. Allows testing before rush.',
    exampleTitle: '📋 PUC Renewal Window Open (15 Days Left)',
    exampleBody:
      'PUC for White Swift expires in 14 days. Plan a quick test at your next fuel refill.',
  },
  {
    id: 'fastag_expired',
    name: 'FASTag Expired / KYC Lapsed',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'CRITICAL',
    timing: 'When FASTag expiration date is in the past (days < 0)',
    conditionDescription:
      'Active FASTag document is expired or KYC suspended. Warns driver that toll booths charge double cash toll for invalid tags.',
    exampleTitle: '🚨 FASTag Expired / KYC Lapsed',
    exampleBody:
      'FASTag for White Swift has expired or needs KYC update. Toll booths charge double cash toll for inactive tags.',
  },
  {
    id: 'fastag_15days',
    name: 'FASTag KYC / Validity Notice (≤ 15 Days)',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'HIGH',
    timing: 'Within 15 days of tag validity or KYC deadline (0 <= days <= 15)',
    conditionDescription:
      'Active FASTag document approaching expiration. Prompts user to check issuing bank portal or NETC portal.',
    exampleTitle: '⚠️ FASTag KYC / Validity Notice',
    exampleBody:
      'FASTag validity or KYC renewal for White Swift is due in 12 days. Check your issuing bank portal.',
  },
  {
    id: 'insurance_expired',
    name: 'Insurance / RC / Warranty Expired',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'CRITICAL',
    timing: 'When document expiration date is in the past (days < 0)',
    conditionDescription:
      'Active Insurance, RC, or Warranty document with expiry_date < today. Driving without third-party insurance is illegal and risks vehicle impoundment.',
    exampleTitle: '🚨 Insurance Expired!',
    exampleBody:
      'Your Insurance for Activa Daily expired 18 days ago. Please renew it immediately.',
  },
  {
    id: 'insurance_7days',
    name: 'Insurance Expiring in ≤ 7 Days',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'HIGH',
    timing: 'Within 7 days of expiration (1 <= days <= 7)',
    conditionDescription:
      'Active insurance policy expiring within 7 days. Fires immediate notification and schedules daily 9:00 AM repeat reminder until updated.',
    exampleTitle: '⚠️ Insurance Expiring in 3 days!',
    exampleBody:
      'Your Insurance for White Swift expires in 3 days. Renew before it lapses!',
  },
  {
    id: 'insurance_30days',
    name: 'Insurance Expiry Notice (8 to 30 Days)',
    category: 'Document',
    channelId: 'document-expiry',
    channelName: 'Document Expiry',
    priority: 'MEDIUM',
    timing: 'Between 8 and 30 days before expiration (8 <= days <= 30)',
    conditionDescription:
      'Active insurance policy enters standard 30-day renewal cycle to prevent break-in inspection fees.',
    exampleTitle: '📋 Insurance Expiry Notice',
    exampleBody:
      'Your Insurance for White Swift expires in 25 days. Plan to renew it soon.',
  },
  {
    id: 'service_overdue',
    name: 'Service Overdue (Mileage or Time)',
    category: 'Service',
    channelId: 'service-due',
    channelName: 'Service Reminders',
    priority: 'CRITICAL',
    timing: 'Current odometer > next_due_km OR today > next_due_date',
    conditionDescription:
      'Vehicle has surpassed recommended service milestone in km or elapsed months from previous service record (whichever breached first).',
    exampleTitle: '🚨 Service Overdue by 1,350 km',
    exampleBody:
      'Activa Daily has reached 13,850 km (due at 12,500 km). Service your vehicle to prevent engine wear.',
  },
  {
    id: 'service_due_soon',
    name: 'Service Due Soon (≤ 500 km or ≤ 7 Days)',
    category: 'Service',
    channelId: 'service-due',
    channelName: 'Service Reminders',
    priority: 'HIGH',
    timing: 'Within 500 km of next service OR within 7 days of next due date',
    conditionDescription:
      'Approaching vehicle service milestone based on dual-dimension check (km threshold or calendar timeline).',
    exampleTitle: '⚠️ Service Due in 320 km',
    exampleBody:
      'White Swift is approaching 30,000 km. Book a service slot soon.',
  },
  {
    id: 'fuel_nudge',
    name: 'Fuel Logging Nudge (14+ Days Inactive)',
    category: 'Fuel',
    channelId: 'general-reminders',
    channelName: 'General Reminders',
    priority: 'LOW',
    timing: '14+ days since last fuel fill (7-day cooldown)',
    conditionDescription:
      'Vehicle has existing fuel entries, but no fuel or charging session has been logged in 14 or more days. Does not nudge brand-new vehicles with zero entries.',
    exampleTitle: '⛽ Time to log your fuel?',
    exampleBody:
      'No fuel logged for White Swift in 16 days. Keep your mileage stats accurate.',
  },
  {
    id: 'monthly_summary',
    name: 'Monthly Driving Cost Summary',
    category: 'Summary',
    channelId: 'general-reminders',
    channelName: 'General Reminders',
    priority: 'LOW',
    timing: '1st of every month at 10:00 AM (Recurring)',
    conditionDescription:
      'Scheduled recurring monthly notification that summarizes fuel refills, maintenance services, and vehicle expenses for the preceding calendar month.',
    exampleTitle: '📊 Your monthly driving summary is ready',
    exampleBody:
      'See how much you spent on fuel, service and expenses last month.',
  },
];
