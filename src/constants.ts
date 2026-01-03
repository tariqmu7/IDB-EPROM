export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export const COLLECTIONS = {
  USERS: 'users',
  FORMS: 'forms',
  IDEAS: 'ideas',
  DEPARTMENTS: 'departments',
  GUESTS: 'guests',
  KPIS: 'kpis'
};

export const DEFAULT_FORM_FIELDS = [
  { label: "Initiative Title", type: "text", required: true },
  { label: "Operational Area", type: "dropdown", options: ["Upstream - Exploration", "Upstream - Drilling", "Midstream - Pipelines", "Downstream - Refining", "HSE & Sustainability", "Asset Integrity", "Digital Transformation"], required: true },
  { label: "Target Asset / Rig", type: "text", required: true, placeholder: "e.g., Platform Alpha, Refinery Unit 4" },
  { label: "Problem Statement", type: "textarea", required: true },
  { label: "Proposed Solution", type: "textarea", required: true },
  { label: "HSE Impact", type: "dropdown", options: ["Positive (Safety Enhancement)", "Neutral", "Requires Risk Assessment"], required: true },
  { label: "Est. CAPEX (USD)", type: "text", required: false },
  { label: "Est. OPEX Savings (USD/Year)", type: "text", required: false },
  { label: "Implementation Timeline", type: "dropdown", options: ["Immediate (<1 mo)", "Short Term (1-6 mo)", "Long Term (>6 mo)"], required: true },
  { label: "Technical Attachments (P&ID, Isometrics)", type: "file", required: false }
];

export const DEFAULT_KPIS = [
  { label: "HSE Compliance & Safety", description: "Does this improve personnel safety or environmental protection?", weight: 30 },
  { label: "Production Efficiency", description: "Impact on barrels/day or uptime.", weight: 25 },
  { label: "Cost Optimization", description: "Reduction in OPEX or CAPEX efficiency.", weight: 25 },
  { label: "Technical Feasibility", description: "Complexity of implementation vs current infrastructure.", weight: 20 }
];

export const DEFAULT_ADMIN = {
  email: 'admin@eprom.com',
  password: 'admin123', 
  role: ROLES.ADMIN,
  name: 'System Admin',
  department: 'Corporate IT',
  status: STATUS.APPROVED
};

// Use environment app ID if available to match the auth token scope
export const APP_ID = (typeof window !== 'undefined' && (window as any).__app_id) ? (window as any).__app_id : "eprom-production-v1";
