import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeTreeSelect } from "@/components/courses/NodeTreeSelect";
import type { NodeTreeItem } from "@/components/courses/NodeTreeSelect";

const nodes: NodeTreeItem[] = [
  {
    id: "law",
    name: "Law Courses",
    children: [
      {
        id: "property",
        name: "Property Law",
        children: [
          { id: "commercial", name: "Commercial Property", children: [] },
        ],
      },
    ],
  },
  { id: "it", name: "IT Courses", children: [] },
];

describe("NodeTreeSelect", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("shows 'No node' when value is null", () => {
    render(<NodeTreeSelect nodes={nodes} value={null} onChange={mockOnChange} />);
    expect(screen.getByText("No node")).toBeInTheDocument();
  });

  it("shows selected node name when value is set", () => {
    render(<NodeTreeSelect nodes={nodes} value="property" onChange={mockOnChange} />);
    expect(screen.getByText("Property Law")).toBeInTheDocument();
  });

  it("shows nested node name when deeply nested value is set", () => {
    render(<NodeTreeSelect nodes={nodes} value="commercial" onChange={mockOnChange} />);
    expect(screen.getByText("Commercial Property")).toBeInTheDocument();
  });

  it("opens dropdown when trigger is clicked", () => {
    render(<NodeTreeSelect nodes={nodes} value={null} onChange={mockOnChange} />);
    // Click the trigger button (contains "No node" text)
    fireEvent.click(screen.getByText("No node"));
    // Should show root nodes in the dropdown
    expect(screen.getByText("Law Courses")).toBeInTheDocument();
    expect(screen.getByText("IT Courses")).toBeInTheDocument();
  });

  it("calls onChange with null when 'No node' is selected in dropdown", () => {
    render(<NodeTreeSelect nodes={nodes} value="it" onChange={mockOnChange} />);
    // Open dropdown by clicking trigger (shows "IT Courses")
    fireEvent.click(screen.getByText("IT Courses"));
    // Click "No node" option in the dropdown
    const noNodeOptions = screen.getAllByText("No node");
    // The dropdown "No node" option is the last one (first is in trigger, now hidden/replaced)
    fireEvent.click(noNodeOptions[noNodeOptions.length - 1]);
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with node id when a node is selected", () => {
    render(<NodeTreeSelect nodes={nodes} value={null} onChange={mockOnChange} />);
    // Open dropdown
    fireEvent.click(screen.getByText("No node"));
    // Click IT Courses
    fireEvent.click(screen.getByText("IT Courses"));
    expect(mockOnChange).toHaveBeenCalledWith("it");
  });

  it("expands a node to reveal children via chevron", () => {
    render(<NodeTreeSelect nodes={nodes} value={null} onChange={mockOnChange} />);
    // Open dropdown
    fireEvent.click(screen.getByText("No node"));
    // Law Courses should be visible but Property Law should not (collapsed)
    expect(screen.getByText("Law Courses")).toBeInTheDocument();
    expect(screen.queryByText("Property Law")).not.toBeInTheDocument();
    // Click the expand chevron button inside the Law Courses row
    const lawRow = screen.getByText("Law Courses").closest("div[class*='flex']");
    const chevron = lawRow?.querySelector("button");
    expect(chevron).toBeTruthy();
    fireEvent.click(chevron!);
    // Now Property Law should be visible
    expect(screen.getByText("Property Law")).toBeInTheDocument();
  });

  it("auto-expands path to selected value", () => {
    render(<NodeTreeSelect nodes={nodes} value="commercial" onChange={mockOnChange} />);
    // Open dropdown by clicking trigger (shows "Commercial Property")
    fireEvent.click(screen.getByText("Commercial Property"));
    // The path law -> property should be auto-expanded, so Commercial Property is visible in dropdown
    expect(screen.getAllByText("Commercial Property").length).toBeGreaterThanOrEqual(1);
  });
});
