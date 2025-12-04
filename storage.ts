import { Recruiter, Applicant, CampaignConfig } from './types';

const STORAGE_KEY = 'recruitment_race_year_end_v1';
const CONFIG_KEY = 'recruitment_race_config_v1';

// The specific list of recruiters for the campaign
const TEAM_ROSTER = [
  'Alice Chen',
  'Bob Smith',
  'Charlie Davis',
  'Diana Prince',
  'Evan Wright',
  'Fiona Gallagher',
  'George Miller',
  'Hannah Lee',
  'Ivan Petrov',
  'Jessica Wu'
];

// Default to current month if not set
const getDefaultConfig = (): CampaignConfig => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const lastDay = new Date(year, month, 0).getDate();
  
  // Format YYYY-MM-DD
  const fmt = (n: number) => n.toString().padStart(2, '0');
  
  return {
    startDate: `${year}-${fmt(month)}-01`,
    endDate: `${year}-${fmt(month)}-${lastDay}`
  };
};

export const getCampaignConfig = (): CampaignConfig => {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  const def = getDefaultConfig();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(def));
  return def;
};

export const saveCampaignConfig = (config: CampaignConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

// Helper to generate fake data within the campaign period
const generateCampaignData = (name: string, id: string): Recruiter => {
  const apps: Applicant[] = [];
  const config = getCampaignConfig();
  
  // Random score for bots/initial state
  const count = Math.floor(Math.random() * 40) + 5; 
  
  const start = new Date(config.startDate).getTime();
  const end = new Date(config.endDate).getTime();

  for (let i = 0; i < count; i++) {
    const randomTime = start + Math.random() * (end - start);
    const date = new Date(randomTime);
    apps.push({
      id: `app-${id}-${i}`,
      email: `candidate${i}@example.com`,
      name: `Candidate ${i}`,
      appliedDate: date.toISOString(),
      source: 'LinkedIn'
    });
  }

  return {
    id,
    name,
    company: 'Talent Team',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`, // Using DiceBear for consistent avatars
    applicants: apps,
    weeklyCount: 0,
    isBot: false // Treat everyone as a real user potnetially
  };
};

export const getStoredData = (): Recruiter[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  let data: Recruiter[] = [];

  if (stored) {
    data = JSON.parse(stored);
  } else {
    // Initialize with the roster if empty
    data = TEAM_ROSTER.map((name, idx) => 
      generateCampaignData(name, `recruiter-${idx}`)
    );
  }

  // Backward compatibility: Ensure weeklyCount exists
  return data.map(r => ({
      ...r,
      weeklyCount: r.weeklyCount !== undefined ? r.weeklyCount : 0
  }));
};

const saveData = (data: Recruiter[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loginUser = (id: string): Recruiter | null => {
  const all = getStoredData();
  return all.find(r => r.id === id) || null;
};

export const addNewRecruiter = (name: string): Recruiter => {
  const all = getStoredData();
  const id = `recruiter-${Date.now()}`; // Unique ID based on timestamp
  
  const newRecruiter: Recruiter = {
    id,
    name,
    company: 'Talent Team',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    applicants: [],
    weeklyCount: 0,
    isBot: false
  };

  all.push(newRecruiter);
  saveData(all);
  return newRecruiter;
};

export const updateRecruiterName = (id: string, newName: string): boolean => {
  const all = getStoredData();
  const index = all.findIndex(r => r.id === id);
  if (index === -1) return false;
  
  all[index].name = newName;
  // Update avatar to match new name for consistency
  all[index].avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newName)}`;
  
  saveData(all);
  return true;
};

export const updateWeeklyCount = (id: string, count: number): boolean => {
    const all = getStoredData();
    const index = all.findIndex(r => r.id === id);
    if (index === -1) return false;

    all[index].weeklyCount = count;
    saveData(all);
    return true;
};

const createApplicants = (count: number, startCount: number, dateStr?: string): Applicant[] => {
    // Create date at noon local time to avoid timezone boundary issues
    let dateObj = new Date();
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      // Construct date using local time
      dateObj = new Date(y, m - 1, d, 12, 0, 0);
    }

    const newApps: Applicant[] = [];
    for (let i = 0; i < count; i++) {
      newApps.push({
        id: `sql-sync-${Date.now()}-${i}`,
        email: `mandarin.candidate.${Date.now()}.${i}@portal-sync.com`,
        name: `Mandarin Candidate ${startCount + i + 1}`,
        appliedDate: dateObj.toISOString(),
        source: 'Portal Sync (Mandarin)'
      });
    }
    return newApps;
};

// Directly adds X applicants to the selected date. Supports negative numbers to remove.
export const addManualApplicants = (recruiterId: string, countToAdd: number, targetDateStr: string): Recruiter | null => {
    if (countToAdd === 0) return null;
    
    const all = getStoredData();
    const index = all.findIndex(r => r.id === recruiterId);
    if (index === -1) return null;

    const recruiter = all[index];

    if (countToAdd > 0) {
        // Add applicants
        const newApps = createApplicants(countToAdd, recruiter.applicants.length, targetDateStr);
        recruiter.applicants = [...recruiter.applicants, ...newApps];
    } else {
        // Remove applicants (Deduct)
        const removeCount = Math.abs(countToAdd);
        if (removeCount >= recruiter.applicants.length) {
            recruiter.applicants = [];
        } else {
            // Remove from the end (LIFO - Last In First Out)
            recruiter.applicants = recruiter.applicants.slice(0, recruiter.applicants.length - removeCount);
        }
    }
    
    all[index] = recruiter;
    saveData(all);
    return recruiter;
};

// Syncs the absolute count. 
export const syncApplicantCount = (recruiterId: string, totalCount: number, targetDateStr?: string): Recruiter | null => {
  const all = getStoredData();
  const index = all.findIndex(r => r.id === recruiterId);
  if (index === -1) return null;

  const recruiter = all[index];
  const currentCount = recruiter.applicants.length;
  const diff = totalCount - currentCount;

  if (diff === 0) return recruiter;

  if (diff > 0) {
    const newApps = createApplicants(diff, currentCount, targetDateStr);
    recruiter.applicants = [...recruiter.applicants, ...newApps];
  } else {
    // If new count is lower (data correction), trim from the end (undo most recent additions)
    // Only do this if strictly needed, usually we discourage lowering scores
    recruiter.applicants = recruiter.applicants.slice(0, totalCount);
  }

  all[index] = recruiter;
  saveData(all);
  return recruiter;
};

// Helper to filter score by campaign date
export const getRecruiterCampaignScore = (recruiter: Recruiter, config: CampaignConfig): number => {
    const start = new Date(config.startDate).getTime();
    const end = new Date(config.endDate).getTime();
    
    // End of day adjustment
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    
    return recruiter.applicants.filter(app => {
        const appTime = new Date(app.appliedDate).getTime();
        return appTime >= start && appTime <= endOfDay.getTime();
    }).length;
};

export const getRecruiterWeeklyScore = (recruiter: Recruiter, config: CampaignConfig): number => {
    if (!config.weeklyStartDate || !config.weeklyEndDate) return 0;

    const start = new Date(config.weeklyStartDate).getTime();
    const end = new Date(config.weeklyEndDate).getTime();
    
    // End of day adjustment for weekly end date
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    return recruiter.applicants.filter(app => {
        const appTime = new Date(app.appliedDate).getTime();
        return appTime >= start && appTime <= endOfDay.getTime();
    }).length;
};