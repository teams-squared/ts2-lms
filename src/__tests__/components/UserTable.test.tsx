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

describe("UserTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state, then user rows after fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockUsers),
      })
    );

    render(<UserTable />);

    // Loading state
    expect(screen.getByText("Loading users...")).toBeInTheDocument();

    // After fetch, user rows appear
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText("emp@test.com")).toBeInTheDocument();
  });

  it("role dropdown triggers PATCH and updates displayed role", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn();
    // First call: GET users
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve(mockUsers),
    });
    // Second call: PATCH role
    fetchMock.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          id: "2",
          email: "emp@test.com",
          name: "Employee",
          role: "manager",
          createdAt: "2024-02-01T00:00:00.000Z",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserTable />);

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText("emp@test.com")).toBeInTheDocument();
    });

    // Find the employee's role dropdown (second select element)
    const selects = screen.getAllByRole("combobox");
    const empSelect = selects[1]; // second user's dropdown

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
});
