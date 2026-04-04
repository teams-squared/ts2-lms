"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prevPathname = useRef(pathname);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    clearTimeout(hideTimer.current);
    clearTimeout(completeTimer.current);

    setWidth(0);
    setVisible(true);
    // Double rAF ensures the width:0 paint commits before animating to 85%
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setWidth(85));
    });

    completeTimer.current = setTimeout(() => {
      setWidth(100);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 300);
    }, 400);

    return () => {
      clearTimeout(hideTimer.current);
      clearTimeout(completeTimer.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 h-[2px] bg-brand-500 z-[60] transition-all duration-300 ease-out"
      style={{ width: `${width}%` }}
      aria-hidden="true"
    />
  );
}
