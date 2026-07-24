export const DOMAIN_OPTIONS = [
  "Artificial Intelligence",
  "Cybersecurity",
  "Data Science",
  "Internet of Things (IoT)",
  "Blockchain",
  "AutoTech",
  "Agriculture",
  "Waste Management",
  "Low Poverty",
  "Open Innovation",
] as const;

export const COLLEGE_OPTIONS = ["St. Peter's Engineering College", "Others"] as const;

export const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

export const DEPARTMENT_OPTIONS = [
  "CSE",
  "CSE (AI & ML)",
  "CSE (Data Science)",
  "CSE (Cyber Security)",
  "IT",
  "ECE",
  "EEE",
  "Mechanical",
  "Civil",
  "Other",
] as const;

export const TEAM_SIZE_OPTIONS = [2, 3, 4] as const;

export const STATUS_OPTIONS = ["pending", "verified", "approved", "rejected"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];
