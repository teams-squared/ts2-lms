"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prevPathname = useRef(pathname);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // START the bar when the user clicks any internal navigation link
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      // Only trigger for same-origin path navigations
      if (!href || !href.startsWith("/")) return;
      // Don't trigger if it's the current page
      if (href === pathname) return;

      clearTimeout(hideTimer.current);
      setWidth(0);
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWidth(75));
      });
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  // COMPLETE the bar when the new page has loaded (pathname changed)
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 300);

    return () => clearTimeout(hideTimer.current);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 h-[3px] z-[9999] transition-[width] duration-300 ease-out"
      style={{
        width: `${width}%`,
        background: "var(--color-brand-500, #5000E8)",
        boxShadow: "0 0 8px 1px var(--color-brand-500, #5000E8)",
      }}
      aria-hidden="true"
    />
  );
}
