"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import type { NodeWithChildren } from "@/lib/courseNodes";
import type { Role } from "@/lib/types";

interface Props {
  /** Course tree already scoped to courses the viewer manages. */
  nodeTree: NodeWithChildren[];
  /** Viewer's role — InviteUserForm uses it to gate the role picker
   *  (course_manager can only invite employees). */
  inviterRole: Role;
}

/**
 * Collapsible "Invite user" affordance for the Enrollments page. Lets course
 * managers (and admins) invite a user and pre-enroll them into the courses they
 * manage in one step. The course picker + invite endpoint are both scoped to
 * managed courses, so a manager can never reach beyond their own courses here.
 */
export function InviteUserPanel({ nodeTree, inviterRole }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mb-4">
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Invite user
        </Button>
      </div>
    );
  }

  return (
    <InviteUserForm
      nodeTree={nodeTree}
      inviterRole={inviterRole}
      onCancel={() => setOpen(false)}
      // The form refreshes the route itself on success; closing returns to the
      // enrollments view where the new enrollment now appears.
      onSuccess={() => {}}
    />
  );
}
