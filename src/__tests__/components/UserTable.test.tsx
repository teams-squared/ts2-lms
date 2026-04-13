import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserTable from "@/components/admin/UserTable";

// Mock UserAvatar to simplify rendering
vi.mock("@/components/ui/UserAvatar", () => ({
  UserAvatar: ({ name }: { name: string | null }) => (
    <span data-testid="avatar">{(name || "?")[0]}</span>
  ),
}));

const mockUsers = [
  {
    id: "1",
    email: "admin@test.com",
    name: "Admin User",
    role: "admin",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    email: "emp@test.com",
    name: "Employee",
    role: "employee",
    createdAt: "2024-02-01T00:00:00.000Z",
  },
];

/** Build a minimal fetch response mock with ok:true and json(). */
function okResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

describe("UserTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state, then user rows after fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(mockUsers)));

    render(<UserTable />);

    // Loading state uses an ellipsis character
    expect(screen.getByText("Loading users…")).toBeInTheDocument();

    // After fetch, user rows appear
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText("emp@test.com")).toBeInTheDocument();
  });

  it("shows an error message when the initial fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: "Server error" }) })
    );

    render(<UserTable />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("role dropdown triggers PATCH and updates displayed role", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn();
    // First call: GET users
    fetchMock.mockResolvedValueOnce(okResponse(mockUsers));
    // Second call: PATCH role
    fetchMock.mockResolvedValueOnce(
      okResponse({
        id: "2",
        email: "emp@test.com",
        name: "Employee",
        role: "manager",
        createdAt: "2024-02-01T00:00:00.000Z",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<UserTable />);

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText("emp@test.com")).toBeInTheDocument();
    });

    // Find the employee's role dropdown by aria-label
    const empSelect = screen.getByRole("combobox", {
      name: /Role for Employee/i,
    });

    await user.selectOptions(empSelect, "manager");

    // Verify PATCH was called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "2", role: "manager" }),
      });
    });
  });

  it("shows inline error when role update fails", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(okResponse(mockUsers));
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Forbidden" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UserTable />);

    await waitFor(() =>
      expect(screen.getByText("emp@test.com")).toBeInTheDocument()
    );

    const empSelect = screen.getByRole("combobox", {
      name: /Role for Employee/i,
    });
    await user.selectOptions(empSelect, "manager");

    await waitFor(() => {
      expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });
  });
});
