import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// next-auth used by AdminTabs.
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// InviteUserForm is huge and not under test here.
vi.mock("@/components/admin/InviteUserForm", () => ({
  InviteUserForm: () => <div data-testid="invite-form-stub">invite</div>,
}));

import { AdminTabs } from "@/components/admin/AdminTabs";
import { IsoTabs, IsoTabPanel } from "@/components/admin/IsoTabs";
import {
  EmailsTabs,
  EmailsTabPanel,
} from "@/components/admin/EmailsTabs";
import { EmailListInput } from "@/components/admin/EmailListInput";
import { UserList } from "@/components/admin/UserList";
import {
  useSearchParams,
  useRouter,
  usePathname,
} from "next/navigation";

const mockedUsePathname = vi.mocked(usePathname);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);

let replaceSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockUseSession.mockReset();
  replaceSpy = vi.fn();
  mockedUseRouter.mockImplementation(
    () =>
      ({
        push: vi.fn(),
        replace: replaceSpy,
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
      }) as ReturnType<typeof useRouter>,
  );
  mockedUseSearchParams.mockImplementation(
    () => new URLSearchParams() as ReturnType<typeof useSearchParams>,
  );
});

describe("AdminTabs", () => {
  it("hides admin-only tabs for non-admins", () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: "course_manager" } },
    });
    mockedUsePathname.mockReturnValue("/admin/courses");
    render(<AdminTabs />);
    expect(screen.queryByText("Users")).toBeNull();
    expect(screen.queryByText("ISO")).toBeNull();
    expect(screen.queryByText("Emails")).toBeNull();
    expect(screen.getByText("Courses")).toBeInTheDocument();
  });

  it("shows admin-only tabs for admins", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "admin" } } });
    mockedUsePathname.mockReturnValue("/admin");
    render(<AdminTabs />);
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("ISO")).toBeInTheDocument();
    expect(screen.getByText("Emails")).toBeInTheDocument();
  });

  it("marks the Overview tab active on exact /admin match", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "admin" } } });
    mockedUsePathname.mockReturnValue("/admin");
    render(<AdminTabs />);
    const overview = screen.getByText("Overview");
    expect(overview.className).toContain("text-primary");
  });

  it("marks the Courses tab active under any /admin/courses* path (non-exact)", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "admin" } } });
    mockedUsePathname.mockReturnValue("/admin/courses/abc/edit");
    render(<AdminTabs />);
    const courses = screen.getByText("Courses");
    expect(courses.className).toContain("text-primary");
  });
});

describe("IsoTabs", () => {
  it("renders both tabs with acks active by default", () => {
    render(<IsoTabs />);
    const acks = screen.getByText("Acknowledgements");
    const coverage = screen.getByText("Coverage");
    expect(acks.getAttribute("aria-current")).toBe("page");
    expect(coverage.getAttribute("aria-current")).toBeNull();
  });

  it("router.replace fires with the right ?tab= search on switch", () => {
    mockedUsePathname.mockReturnValue("/admin/iso");
    render(<IsoTabs />);
    fireEvent.click(screen.getByText("Coverage"));
    expect(replaceSpy).toHaveBeenCalledWith("/admin/iso?tab=coverage", {
      scroll: false,
    });
  });

  it("drops the ?tab= search when switching back to the default tab", () => {
    mockedUsePathname.mockReturnValue("/admin/iso");
    mockedUseSearchParams.mockImplementation(
      () => new URLSearchParams("tab=coverage") as ReturnType<typeof useSearchParams>,
    );
    render(<IsoTabs />);
    fireEvent.click(screen.getByText("Acknowledgements"));
    expect(replaceSpy).toHaveBeenCalledWith("/admin/iso", { scroll: false });
  });

  it("IsoTabPanel renders only when its tab is active", () => {
    mockedUseSearchParams.mockImplementation(
      () => new URLSearchParams("tab=coverage") as ReturnType<typeof useSearchParams>,
    );
    render(
      <>
        <IsoTabPanel tab="acks">acks-body</IsoTabPanel>
        <IsoTabPanel tab="coverage">coverage-body</IsoTabPanel>
      </>,
    );
    expect(screen.queryByText("acks-body")).toBeNull();
    expect(screen.getByText("coverage-body")).toBeInTheDocument();
  });
});

describe("EmailsTabs", () => {
  it("renders three tabs and switches via router.replace", () => {
    mockedUsePathname.mockReturnValue("/admin/emails");
    render(<EmailsTabs />);
    expect(screen.getByText("Invite email")).toBeInTheDocument();
    expect(screen.getByText("Signature")).toBeInTheDocument();
    expect(screen.getByText("ISO Ack Email")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Signature"));
    expect(replaceSpy).toHaveBeenCalledWith("/admin/emails?tab=signature", {
      scroll: false,
    });
  });

  it("EmailsTabPanel hides inactive panels", () => {
    mockedUseSearchParams.mockImplementation(
      () => new URLSearchParams("tab=signature") as ReturnType<typeof useSearchParams>,
    );
    render(
      <>
        <EmailsTabPanel tab="invite">invite-body</EmailsTabPanel>
        <EmailsTabPanel tab="signature">signature-body</EmailsTabPanel>
      </>,
    );
    expect(screen.queryByText("invite-body")).toBeNull();
    expect(screen.getByText("signature-body")).toBeInTheDocument();
  });
});

describe("EmailListInput", () => {
  it("renders the label, helper, and existing emails as pills", () => {
    render(
      <EmailListInput
        label="Recipients"
        helper="Comma-separate or press enter"
        value={["a@b.com", "c@d.com"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Recipients")).toBeInTheDocument();
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.getByText("c@d.com")).toBeInTheDocument();
  });

  it("shows emptyHint when no emails and emptyHint is supplied", () => {
    render(
      <EmailListInput
        label="Recipients"
        helper="x"
        emptyHint="No recipients yet"
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("No recipients yet")).toBeInTheDocument();
  });

  it("adds a valid email on Enter and clears the draft input", () => {
    const onChange = vi.fn();
    render(
      <EmailListInput
        label="x"
        helper="x"
        value={[]}
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText(
      "name@teamsquared.io",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "user@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["user@example.com"]);
    expect(input.value).toBe("");
  });

  it("adds a valid email via the Add button (also lowercases it)", () => {
    const onChange = vi.fn();
    render(
      <EmailListInput
        label="x"
        helper="x"
        value={[]}
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText("name@teamsquared.io");
    fireEvent.change(input, { target: { value: "MIXED@case.COM" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenCalledWith(["mixed@case.com"]);
  });

  it("rejects an invalid email with a localised error", () => {
    const onChange = vi.fn();
    render(
      <EmailListInput
        label="x"
        helper="x"
        value={[]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("name@teamsquared.io"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/is not a valid email/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email", () => {
    const onChange = vi.fn();
    render(
      <EmailListInput
        label="x"
        helper="x"
        value={["x@y.com"]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("name@teamsquared.io"), {
      target: { value: "x@y.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Already added")).toBeInTheDocument();
  });

  it("removes a pill when its × button is clicked", () => {
    const onChange = vi.fn();
    render(
      <EmailListInput
        label="x"
        helper="x"
        value={["a@b.com", "c@d.com"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove a@b.com"));
    expect(onChange).toHaveBeenCalledWith(["c@d.com"]);
  });

  it("comma key also triggers add", () => {
    const onChange = vi.fn();
    render(
      <EmailListInput label="x" helper="x" value={[]} onChange={onChange} />,
    );
    const input = screen.getByPlaceholderText("name@teamsquared.io");
    fireEvent.change(input, { target: { value: "x@y.com" } });
    fireEvent.keyDown(input, { key: "," });
    expect(onChange).toHaveBeenCalledWith(["x@y.com"]);
  });
});

describe("UserList", () => {
  const userRows = Array.from({ length: 30 }, (_, i) => ({
    id: `u${i}`,
    email: `user${i}@example.com`,
    name: i % 2 === 0 ? `User ${i}` : null,
    avatar: null,
    role:
      i === 0 ? ("admin" as const) : i === 1 ? ("course_manager" as const) : ("employee" as const),
    createdAt: new Date(`2026-01-${(i % 27) + 1}`).toISOString(),
  }));

  it("renders the first page (25 rows) with totals", () => {
    render(
      <UserList users={userRows} nodeTree={[]} inviterRole="admin" />,
    );
    expect(screen.getByText("30 users")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("filters by search and resets page to 1", () => {
    render(
      <UserList users={userRows} nodeTree={[]} inviterRole="admin" />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search by name or email/), {
      target: { value: "user2" },
    });
    // Roughly: users containing "user2" → user2, user20..29 etc.
    expect(screen.getByText(/of 30 users/)).toBeInTheDocument();
  });

  it("filters by role", () => {
    render(
      <UserList users={userRows} nodeTree={[]} inviterRole="admin" />,
    );
    fireEvent.change(screen.getByDisplayValue("All roles"), {
      target: { value: "admin" },
    });
    // Only user0 is admin → 1 of 30.
    expect(screen.getByText("1 of 30 users")).toBeInTheDocument();
  });

  it("paginates next/prev", () => {
    render(
      <UserList users={userRows} nodeTree={[]} inviterRole="admin" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("toggles the InviteUserForm visibility", () => {
    render(
      <UserList users={[]} nodeTree={[]} inviterRole="admin" />,
    );
    expect(screen.queryByTestId("invite-form-stub")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Invite user" }));
    expect(screen.getByTestId("invite-form-stub")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("invite-form-stub")).toBeNull();
  });

  it("shows the no-results state when search matches nothing", () => {
    render(
      <UserList users={userRows} nodeTree={[]} inviterRole="admin" />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Search by name or email/), {
      target: { value: "definitely-not-in-the-data" },
    });
    expect(screen.getByText("No users match your search.")).toBeInTheDocument();
  });
});
