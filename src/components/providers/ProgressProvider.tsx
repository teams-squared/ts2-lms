"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import Toast from "@/components/ui/Toast";
import type { UserProgress, DocProgress, Badge } from "@/lib/types";

const STORAGE_KEY = "ts2-lms-progress";

const emptyProgress: UserProgress = {
  docs: {},
  badges: [],
  streak: { currentStreak: 0, longestStreak: 0, lastActivityDate: "" },
  lastSyncedAt: "",
};

interface ProgressContextValue {
  progress: UserProgress;
  isDocCompleted: (docKey: string) => boolean;
  getDocProgress: (docKey: string) => DocProgress | null;
  updateProgress: (
    docKey: string,
    update: Partial<DocProgress>
  ) => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue>({
  progress: emptyProgress,
  isDocCompleted: () => false,
  getDocProgress: () => null,
  updateProgress: async () => {},
});

export function useProgress() {
  return useContext(ProgressContext);
}

export default function ProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [progress, setProgress] = useState<UserProgress>(() =>
    getStorageItem<UserProgress>(STORAGE_KEY, emptyProgress)
  );
  const [toastQueue, setToastQueue] = useState<Badge[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/progress")
      .then((res) => res.json())
      .then((data: UserProgress) => {
        setProgress(data);
        setStorageItem(STORAGE_KEY, data);
      })
      .catch(() => {});
  }, [status]);

  const isDocCompleted = useCallback(
    (docKey: string) => {
      const dp = progress.docs[docKey];
      return dp?.completedAt !== null && dp?.completedAt !== undefined;
    },
    [progress]
  );

  const getDocProgress = useCallback(
    (docKey: string): DocProgress | null => {
      return progress.docs[docKey] ?? null;
    },
    [progress]
  );

  const updateProgress = useCallback(
    async (docKey: string, update: Partial<DocProgress>) => {
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docKey, update }),
        });
        const data = await res.json();
        if (data.progress) {
          setProgress(data.progress);
          setStorageItem(STORAGE_KEY, data.progress);
        }
        if (data.newBadges && data.newBadges.length > 0) {
          setToastQueue((prev) => [...prev, ...data.newBadges]);
        }
      } catch {
        // silent fail — progress will sync on next load
      }
    },
    []
  );

  return (
    <ProgressContext.Provider
      value={{ progress, isDocCompleted, getDocProgress, updateProgress }}
    >
      {children}
      {toastQueue.length > 0 && (
        <Toast
          message={`Badge earned: ${toastQueue[0].name}!`}
          icon={toastQueue[0].icon}
          onClose={() => setToastQueue((prev) => prev.slice(1))}
        />
      )}
    </ProgressContext.Provider>
  );
}
