import { Timestamp } from "firebase-admin/firestore";

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  summary?: string;
  jobTitle?: string;
  links?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    [key: string]: string | undefined;
  };
}

export interface EducationItem {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface ExperienceItem {
  company: string;
  position: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  location?: string;
}

export interface SkillItem {
  name: string;
  level?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
}

export interface ProjectItem {
  title: string;
  description?: string;
  link?: string;
  technologies?: string[];
  startDate?: string;
  endDate?: string;
}

export interface ResumeContent {
  personalInfo: PersonalInfo;
  education?: EducationItem[];
  experience?: ExperienceItem[];
  skills?: SkillItem[];
  projects?: ProjectItem[];
  languages?: string[];
  certifications?: any[];
  [key: string]: any; // Allow extensibility
}

export interface Resume {
  id?: string;
  userId: string;
  title: string; // User-defined name for the file (e.g. "Software Engineer v1")
  template: string; // e.g. "classic", "modern"
  content: ResumeContent;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SaveResumeRequest {
  resumeId?: string;
  title?: string;
  template?: string;
  content: ResumeContent;
}
