"use client";

import { useRef, useState } from "react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { FormButton } from "@/components/ui/FormButton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RevealOnView } from "@/components/ui/RevealOnView";
import {
  BookOpenIcon,
  BarChartIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";

/**
 * First-login onboarding — a quick, role-agnostic intro to the LMS shown once
 * per user. The same two slides are seen by employees, course managers, and
 * admins, so nothing here references role-specific surfaces.
 *
 * Persistence is server-side: the parent renders this only when the user's
 * `onboardedAt` is null. We POST to /api/user/onboarding to stamp it on close
 * (whether they finish or dismiss), so it never reappears on the next session.
 */

interface Feature {
  Icon: typeof BookOpenIcon;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    Icon: BookOpenIcon,
    title: "Work through courses",
    desc: "Lessons, documents, and quizzes, at your own pace.",
  },
  {
    Icon: BarChartIcon,
    title: "Track your progress",
    desc: "Pick up where you left off and build your streak.",
  },
  {
    Icon: ClockIcon,
    title: "Stay on time",
    desc: "Deadlines and reminders keep your training current.",
  },
];

const TOTAL_STEPS = 2;

export function OnboardingModal({ needsOnboarding }: { needsOnboarding: boolean }) {
  const [open, setOpen] = useState(needsOnboarding);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const markedRef = useRef(false);

  // Render nothing for users who've already onboarded — keeps the dashboard
  // tree clean and avoids a stray POST.
  if (!needsOnboarding) return null;

  async function markComplete() {
    if (markedRef.current) return;
    markedRef.current = true;
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
    } catch {
      // Non-critical: if the stamp fails the modal simply shows again next
      // session. Never block the user on it.
    }
  }

  // Any close path (X, Escape, overlay click) counts as "seen".
  function handleOpenChange(next: boolean) {
    if (!next) {
      void markComplete();
      setOpen(false);
    }
  }

  async function finish() {
    setSaving(true);
    await markComplete();
    setSaving(false);
    setSaved(true);
    setOpen(false);
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="onboarding-modal">
        <div className="flex flex-col items-center gap-6 py-2 text-center">
          <Logo size={40} showText={false} />

          <RevealOnView key={step} className="flex w-full flex-col items-center gap-4">
            {step === 0 ? (
              <>
                <DialogTitle className="font-display text-2xl font-bold text-foreground">
                  Welcome to Teams Squared
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="max-w-sm text-sm text-foreground-muted">
                    This is your learning hub. Take courses, track your progress,
                    and keep your training up to date, all in one place.
                  </p>
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="font-display text-2xl font-bold text-foreground">
                  How it works
                </DialogTitle>
                <DialogDescription className="sr-only">
                  An overview of what you can do in the LMS.
                </DialogDescription>
                <ul className="flex w-full flex-col gap-3 text-left">
                  {FEATURES.map(({ Icon, title, desc }) => (
                    <li
                      key={title}
                      className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted px-3 py-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">
                          {title}
                        </span>
                        <span className="text-xs text-foreground-muted">{desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </RevealOnView>

          {/* Pager dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-border-strong"
                }`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex w-full items-center justify-between gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Skip
              </Button>
            )}

            {isLast ? (
              <FormButton loading={saving} success={saved} onClick={finish}>
                Get started
              </FormButton>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>
                Next
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
