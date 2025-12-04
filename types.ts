export interface Applicant {
  id: string;
  email: string; // Unique identifier for distinct check
  name: string;
  appliedDate: string; // ISO string
  source: string;
}

export interface Recruiter {
  id: string;
  name: string;
  avatar: string;
  applicants: Applicant[];
  weeklyCount: number; // New field for manual weekly tracking
  company: string;
  isBot?: boolean;
}

export interface MonthlyStat {
  month: string; // "Jan 2024"
  count: number;
}

export interface CampaignState {
  currentUser: Recruiter | null;
  allRecruiters: Recruiter[];
}

export interface CampaignConfig {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  weeklyStartDate?: string;
  weeklyEndDate?: string;
}