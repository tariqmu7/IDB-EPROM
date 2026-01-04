
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  GUEST = 'GUEST'
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string;
  username: string;
  email: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  password?: string;
}

export enum IdeaStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  NEEDS_REVISION = 'NEEDS_REVISION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED'
}

// Dynamic Form Definitions
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // For select inputs
  required: boolean;
}

// KPI / Rating Definitions
export interface RatingDimension {
  id: string;
  name: string;
  description: string;
  weight: number; // Percentage (0-100)
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  ratingConfig: RatingDimension[]; // The KPIs specific to this form
  isActive: boolean;
}

export interface RatingDetail {
  dimensionId: string;
  score: number; // 1-5
}

export interface Rating {
  managerId: string;
  managerName: string;
  details: RatingDetail[];
  totalScore: number; // The weighted average (1-5)
  percentage: number; // 0-100
  grade: string; // A, B, C, D
  comment: string;
  createdAt: string;
}

export interface Idea {
  id: string;
  authorId: string;
  authorName: string;
  department: string;
  createdAt: string;
  updatedAt: string;
  
  // Core Fields (Always required)
  title: string;
  description: string;
  category: string;
  
  // Presentation
  coverImage?: string; // Base64 image data

  // Collaboration Linkage
  parentIdeaId?: string; // If this idea is a contribution/collaboration to another idea
  
  // Dynamic Content
  templateId: string;
  templateName: string;
  dynamicData: Record<string, any>; // Stores answers to the dynamic fields
  
  // Legacy/Helper fields (kept for type compatibility if needed, but primarily using dynamicData now)
  tags: string[];
  
  // Workflow
  status: IdeaStatus;
  ratings: Rating[];
  comments: Comment[];
  managerFeedback?: string;
  
  // Attachments (Base64)
  attachments?: string[]; 
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface AppSettings {
  appName: string;
  logoUrl: string;
  departments: string[];
  categories: string[];
}