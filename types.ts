export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  username?: string;
  phone?: string;
}

export interface Idea {
  id: string;
  employeeId: string;
  employeeName: string;
  formTitle: string;
  category: string;
  status: string;
  formData: Record<string, any>;
  mainDepartment: string;
  subDepartments?: string[];
  submittedAt: string;
  publicId?: string;
  collaborationGroupId?: string;
  coverImage?: string;
  isPublic?: boolean;
  duplicateFlag?: {
    matchId: string;
    matchTitle: string;
    reason: string;
  };
  comments?: Comment[];
  collaborators?: Collaborator[];
  ratings?: Record<string, Rating>;
  rating?: RatingSummary;
  aiSummary?: string;
  implementationPlan?: string;
}

export interface Comment {
  id: number;
  author: string;
  text: string;
  date: string;
}

export interface Collaborator {
  id: string;
  name: string;
  joinedAt: string;
}

export interface RatingDetail {
  label: string;
  score: number;
  weight?: number;
}

export interface Rating {
  percentage: number;
  grade: string;
  details: RatingDetail[];
  managerName?: string;
  date?: string;
}

export interface RatingSummary {
  percentage: number;
  grade: string;
  count: number;
  details?: RatingDetail[];
}

export interface FormTemplate {
  id: string;
  title: string;
  category: string;
  fields: FormField[];
}

export interface FormField {
  label: string;
  type: string;
  required?: boolean;
  options?: string[] | string; // string when editing, array when saved
  placeholder?: string;
}

export interface KPI {
  label: string;
  description: string;
  weight: number;
}

declare global {
  interface Window {
    html2pdf: any;
  }
}