export const SUPPORT_EMAIL = 'support@happyhomeshub.com';
export const APP_URL = 'https://app.happyhomeshub.com';

export const HANDYMAN_SERVICES = [
  'General Maintenance',
  'Plumbing',
  'Electrical',
  'HVAC / Heating & Cooling',
  'Carpentry & Woodwork',
  'Painting',
  'Flooring',
  'Appliance Repair',
  'Landscaping & Lawn Care',
  'Roofing',
  'Drywall & Plastering',
  'Windows & Doors',
  'Pool Maintenance',
  'Pest Control',
] as const;

export const SERVICE_RADII = ['5 miles', '10 miles', '25 miles', '50 miles', '100+ miles'] as const;

export const HANDYMAN_AVAIL = [
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'evenings', label: 'Evenings' },
  { key: 'anytime', label: 'Anytime' },
  { key: 'by_appointment', label: 'By Appointment' },
] as const;

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

export const ROLE_META = {
  landlord: {
    label: 'Landlord',
    desc: 'Manage your properties, tenants, rent, and maintenance',
    color: '#D4972A',
    bg: '#0D1F2D',
  },
  tenant: {
    label: 'Tenant',
    desc: 'View your tenancy, pay rent, and submit repair requests',
    color: '#00C8BB',
    bg: '#12202E',
  },
  handyman: {
    label: 'Handyman',
    desc: 'Browse and manage maintenance jobs from landlords',
    color: '#34D399',
    bg: '#1B3A2F',
  },
} as const;

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
