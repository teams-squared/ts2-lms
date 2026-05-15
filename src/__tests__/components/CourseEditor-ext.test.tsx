import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/courses/NodeTreeSelect", () => ({
  NodeTreeSelect: () => <div data-testid="node-tree-select-stub" />,
}));

import { CourseEditor } from "@/components/courses/CourseEditor";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

const baseProps = {
  courseId: "c-1",
  initialTitle: "Auth Basics",
  initialDescription: "Intro to auth.",
  initialStatus: "PUBLISHED" as const,
  initialNodeId: null,
  nodeTree: [],
  initialSubscriptions: ["existing@example.com"],
};

describe("CourseEditor — email subscriptions", () => {
  it("renders the existing subscription with a Remove affordance", () => {
    render(<CourseEditor {...baseProps} />);
    expect(screen.getByText("existing@example.com")).toBeInTheDocument();
  });

  it("rejects an invalid email with an inline error", () => {
    render(<CourseEditor {...baseProps} />);
    const input = screen.getByPlaceholderText(/example\.com/i);
    fireEvent.change(input, { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add email$/ }));
    expect(
      screen.getByText("Enter a valid email address"),
    ).toBeInTheDocument();
  });

  it("rejects a duplicate subscription", () => {
    render(<CourseEditor {...baseProps} />);
    const input = screen.getByPlaceholderText(/example\.com/i);
    fireEvent.change(input, { target: { value: "existing@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add email$/ }));
    expect(screen.getByText("Already subscribed")).toBeInTheDocument();
  });

  it("POSTs a new subscription when valid", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    render(<CourseEditor {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText(/example\.com/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add email$/ }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/courses/c-1/subscriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("CourseEditor — status select", () => {
  it("exposes the three CourseStatus options", () => {
    render(<CourseEditor {...baseProps} />);
    const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["draft", "published", "archived"]);
  });

  it("updates the status select on change", () => {
    render(<CourseEditor {...baseProps} />);
    const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "archived" } });
    expect(select.value).toBe("archived");
  });
});
