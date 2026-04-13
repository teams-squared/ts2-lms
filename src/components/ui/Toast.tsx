"use client";

import { useState, useEffect } from "react";

interface ToastProps {
  message: string;
  icon?: string;
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  icon,
  duration = 4000,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for exit animation
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#1c1c24] border border-brand-200 dark:border-brand-800 shadow-lg">
        {icon && (
          <span
            className="text-xl"
            dangerouslySetInnerHTML={{ __html: icon }}
          />
        )}
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {message}
        </span>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs ml-2"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
