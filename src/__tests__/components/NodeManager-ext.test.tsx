import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

import { ToastProvider } from "@/components/ui/ToastProvider";
import { NodeManager } from "@/components/admin/NodeManager";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const tree = [
  {
    id: "n-root",
    name: "Root",
    slug: "root",
    parentId: null,
    courses: [
      {
        id: "c-1",
        title: "Auth Basics",
        thumbnail: null,
        status: "PUBLISHED" as const,
      },
    ],
    children: [
      {
        id: "n-child",
        name: "Child",
        slug: "child",
        parentId: "n-root",
        courses: [],
        children: [],
      },
    ],
  },
];

describe("NodeManager — interactions", () => {
  it("opens the Add-root inline form on click", () => {
    wrap(<NodeManager initialTree={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add root node/i }));
    expect(screen.getByPlaceholderText(/Root node name/)).toBeInTheDocument();
  });

  it("enables the inline Add button only when the name is non-empty", () => {
    wrap(<NodeManager initialTree={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add root node/i }));
    // Two Add buttons render (root form Add + Add root node), pick the inline.
    const addBtn = screen
      .getAllByRole("button", { name: /^Add$/ })
      .find((b) => b !== null);
    expect(addBtn?.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/Root node name/), {
      target: { value: "New node" },
    });
    expect(addBtn?.hasAttribute("disabled")).toBe(false);
  });

  it("Cancel closes the Add-root inline form", () => {
    wrap(<NodeManager initialTree={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add root node/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(screen.queryByPlaceholderText(/Root node name/)).toBeNull();
  });

  it("POSTs when Enter is pressed inside the Add-root input", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => [] } as Response);
    wrap(<NodeManager initialTree={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Add root node/i }));
    const input = screen.getByPlaceholderText(/Root node name/);
    fireEvent.change(input, { target: { value: "New Root" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/nodes",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("renders a tree node with its name and a click-to-rename surface", () => {
    wrap(<NodeManager initialTree={tree} />);
    expect(
      screen.getByRole("button", { name: "Root" }),
    ).toBeInTheDocument();
  });

  it("opens the rename input when a node name is clicked", () => {
    wrap(<NodeManager initialTree={tree} />);
    fireEvent.click(screen.getByRole("button", { name: "Root" }));
    // After click, an editable input with the current name appears.
    expect(screen.getByDisplayValue("Root")).toBeInTheDocument();
  });
});
