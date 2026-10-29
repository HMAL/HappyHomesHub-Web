export type UserRole = 'landlord' | 'tenant' | 'handyman';

export type AppLanguage = 'en' | 'es';

export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  business_name?: string;
  avatar_url?: string;
  language?: AppLanguage;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  role: UserRole;
  context_id: string;
  context_type: 'tenancy' | 'property' | 'handyman_profile' | 'global';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface Property {
  id: string;
  landlord_id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  unit_number?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export type TenancyStatus = 'pending_invite' | 'active' | 'ended';

export type LateFeeType = 'fixed' | 'percent';

export interface Tenancy {
  id: string;
  property_id: string;
  tenant_id?: string;
  lease_start?: string;
  lease_end?: string;
  monthly_rent: number;
  deposit_amount: number;
  deposit_collected: boolean;
  status: TenancyStatus;
  late_fee_enabled?: boolean;
  late_fee_grace_days?: number;
  late_fee_type?: LateFeeType;
  late_fee_amount?: number | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  property?: Property;
  tenant?: User;
}

export interface Invite {
  id: string;
  property_id: string;
  tenancy_id: string;
  landlord_id: string;
  email?: string;
  phone?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export type InspectionType = 'move_in' | 'move_out' | 'routine';

export interface Inspection {
  id: string;
  tenancy_id: string;
  type: InspectionType;
  conducted_by: string;
  notes?: string;
  tenant_signed_at?: string;
  tenant_signed_by?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  photos?: InspectionPhoto[];
  tenancy?: Tenancy & { property?: Property };
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  room_label?: string;
  created_at: string;
  created_by: string;
}

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface MaintenanceRequest {
  id: string;
  tenancy_id: string;
  submitted_by: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  scheduled_for?: string | null;
  handyman_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  updates?: MaintenanceUpdate[];
  submitter?: User;
  photos?: MaintenancePhoto[];
  tenancy?: Tenancy & { property?: Property };
}

export interface MaintenanceUpdate {
  id: string;
  request_id: string;
  user_id: string;
  note: string;
  status_change?: MaintenanceStatus;
  created_at: string;
  user?: User;
}

export interface MaintenancePhoto {
  id: string;
  request_id: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  created_at: string;
  created_by: string;
}

export interface Deposit {
  id: string;
  tenancy_id: string;
  total_amount: number;
  collected_at?: string;
  returned_amount?: number;
  returned_at?: string;
  deductions: DepositDeduction[];
  status: 'held' | 'partially_returned' | 'returned' | 'disputed';
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface DepositDeduction {
  description: string;
  amount: number;
  date: string;
}

export interface Subscription {
  id: string;
  landlord_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  property_count: number;
  amount_per_property: number;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_end: string | null;
  promo_code?: string | null;
  free_property_units?: number;
  tier?: LandlordTier;
  created_at: string;
  updated_at: string;
}

export type LandlordTier = 'landlord' | 'super';

export type ReferralRewardKind = 'property_month_free' | 'screening_discount';

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  code: string;
  status: 'pending' | 'rewarded';
  created_at: string;
  rewarded_at?: string | null;
}

export interface ReferralReward {
  id: string;
  user_id: string;
  referral_id?: string | null;
  kind: ReferralRewardKind;
  amount_cents: number;
  status: 'available' | 'redeemed';
  created_at: string;
  redeemed_at?: string | null;
}

export type PromoDiscountType = 'first_property_free' | 'percent' | 'free_months' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  description?: string | null;
  discount_type: PromoDiscountType;
  discount_value?: number | null;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  changed_by: string;
  changed_at: string;
  changed_by_user?: User;
}

export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'denied';
export type EmploymentType = 'full_time' | 'part_time' | 'self_employed' | 'unemployed' | 'other';

export interface ApplicationReference {
  name: string;
  phone: string;
  relationship: string;
}

export interface Application {
  id: string;
  tenancy_id: string;
  property_id: string;
  applicant_id: string;
  date_of_birth?: string;
  ssn_last_four?: string;
  employer_name?: string;
  employer_phone?: string;
  monthly_income?: number;
  employment_type?: EmploymentType;
  employment_start_date?: string;
  current_address?: string;
  current_landlord_name?: string;
  current_landlord_phone?: string;
  current_monthly_rent?: number;
  reason_for_moving?: string;
  has_pets: boolean;
  pet_description?: string;
  vehicle_count: number;
  applicant_references: ApplicationReference[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  background_check_consent: boolean;
  credit_check_consent: boolean;
  status: ApplicationStatus;
  landlord_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  applicant?: User;
  property?: Property;
}

export type RentPaymentStatus = 'pending' | 'processing' | 'paid' | 'late' | 'waived' | 'partial';
export type PaymentMethod = 'stripe' | 'card' | 'ach' | 'check' | 'cash' | 'bank_transfer' | 'money_order' | 'other';

export interface RentPayment {
  id: string;
  tenancy_id: string;
  amount: number;
  due_date: string;
  paid_at?: string;
  payment_method?: PaymentMethod;
  stripe_payment_intent_id?: string;
  status: RentPaymentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface Message {
  id: string;
  tenancy_id: string;
  sender_id: string;
  receiver_id?: string;
  body: string;
  read_at?: string;
  created_at: string;
  sender?: User;
}

export type DocumentType = 'lease_agreement' | 'inspection_move_in' | 'inspection_move_out' | 'notice' | 'addendum' | 'other';
export type SignatureStatus = 'none' | 'requested' | 'signed' | 'declined';

export interface Document {
  id: string;
  tenancy_id?: string;
  property_id?: string;
  uploaded_by: string;
  type: DocumentType;
  title: string;
  storage_path: string;
  file_size?: number;
  signature_status: SignatureStatus;
  signature_requested_at?: string;
  signature_requested_by?: string;
  signed_at?: string;
  signed_by?: string;
  signature_image_path?: string;
  signer_name_confirmed?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export type ExpenseCategory = 'maintenance' | 'insurance' | 'taxes' | 'utilities' | 'mortgage' | 'management_fee' | 'landscaping' | 'cleaning' | 'other';

export interface Expense {
  id: string;
  property_id: string;
  landlord_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  receipt_path?: string;
  maintenance_request_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  property?: Property;
}

export interface PropertySummary {
  property: Property;
  tenancy?: Tenancy;
  rentCollected: number;
  rentTotal: number;
  openRequests: number;
  isVacant: boolean;
}

export interface LandlordStats {
  totalProperties: number;
  vacancies: number;
  activeTenantsCount: number;
  openRequestsCount: number;
  rentCollectedThisMonth: number;
  rentExpectedThisMonth: number;
}

export interface TenantDashboardData {
  tenancy: Tenancy | null;
  property: Property | null;
  nextPayment: RentPayment | null;
  openRequests: number;
  unreadMessages: number;
  applicationStatus: ApplicationStatus | null;
}

export type HandymanSkill =
  | 'Plumbing' | 'Electrical' | 'HVAC' | 'Carpentry' | 'Painting'
  | 'Appliance Repair' | 'Roofing' | 'Flooring' | 'Landscaping'
  | 'Cleaning' | 'Pest Control' | 'Welding' | 'Masonry' | 'Other';

export type HandymanAvailability =
  | 'weekdays' | 'weekends' | 'evenings' | 'anytime' | 'by_appointment';

export interface HandymanProfile {
  id: string;
  user_id: string;
  skills: HandymanSkill[];
  availability: HandymanAvailability[];
  service_area: string;
  service_phone?: string;
  service_radius_miles?: number;
  bio?: string;
  working_hours?: string;
  is_available: boolean;
  verified: boolean;
  rating?: number;
  completed_jobs: number;
  created_at: string;
  updated_at: string;
}

export interface HandymanReview {
  id: string;
  handyman_user_id: string;
  reviewer_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  updated_at: string;
  reviewer?: User;
}

export type ScreeningReportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ScreeningRecommendation = 'approved' | 'consider' | 'declined';

export interface ScreeningReport {
  id: string;
  applicant_id: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  amount_paid: number;
  report_status: ScreeningReportStatus;
  smartmove_order_id?: string;
  report_url?: string;
  score?: number;
  recommendation?: ScreeningRecommendation;
  application_limit?: number | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export type HandymanJobStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface HandymanJob {
  id: string;
  maintenance_request_id: string;
  handyman_id?: string;
  status: HandymanJobStatus;
  quoted_amount?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  maintenance_request?: MaintenanceRequest;
  handyman?: User;
}

export interface HandymanDashboardData {
  openJobs: number;
  activeJobs: number;
  completedJobs: number;
  unreadMessages: number;
  profile: HandymanProfile | null;
}
