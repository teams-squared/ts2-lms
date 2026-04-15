"use client";

import { useState, useEffect } from "react";
import { CloseIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  courseId: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = (await res.json()) as {
          notifications: Notification[];
          unreadCount: number;
        };
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchNotifications();
    // Poll every 60s
    const interval = setInterval(() => void fetchNotifications(), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      setLoading(true);
      try {
        await fetch("/api/notifications", { method: "PATCH" });
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => void handleOpen()}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
      >
        <svg
          className="w-5 h-5 text-gray-500 dark:text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 z-50 w-80 rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-elevated">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2e2e3a] flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Notifications
              </p>
              <div className="flex items-center gap-2">
                {loading && <Spinner size="sm" />}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#2e2e3a] transition-colors"
                  aria-label="Close notifications"
                >
                  <CloseIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 px-4 py-6 text-center">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 text-sm ${
                        !n.read
                          ? "bg-brand-50 dark:bg-brand-950/10"
                          : ""
                      }`}
                    >
                      <p className="text-gray-800 dark:text-gray-200">
                        {n.message}
                      </p>
                      {n.courseId && (
                        <a
                          href={`/courses/${n.courseId}`}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-0.5 block"
                          onClick={() => setOpen(false)}
                        >
                          View course →
                        </a>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
