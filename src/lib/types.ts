export type Role = "admin" | "manager" | "employee";

export interface RoleConfig {
  admins: string[];
  managers: string[];
  defaultRole: string;
}

export interface DocMeta {
  title: string;
  description: string;
  slug: string;
  category: string;
  minRole: Role;
  updatedAt: string;
  author?: string;
  tags?: string[];
  order?: number;
  passwordProtected?: boolean;
  hasQuiz?: boolean;
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  icon: string;
  minRole: Role;
  parentCategory?: string;
  order?: number;
}

// ── LMS / Quiz types ────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface QuizDefinition {
  passingScore: number;
  questions: QuizQuestion[];
}

export interface DocProgress {
  completedAt: string | null;
  quizScore: number | null;
  quizPassedAt: string | null;
  quizAttempts: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
}

export interface UserProgress {
  docs: Record<string, DocProgress>;
  badges: Badge[];
  streak: StreakInfo;
  lastSyncedAt: string;
}
