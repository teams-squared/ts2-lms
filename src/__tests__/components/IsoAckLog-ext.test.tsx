import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IsoAckLog } from "@/components/admin/IsoAckLog";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function makeAck(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ack-1",
    acknowledgedAt: new Date("2026-04-01T12:00:00Z").toISOString(),
    employee: { id: "u-1", name: "Alice", email: "alice@example.com" },
    courseTitle: "Compliance Course",
    documentTitle: "Privacy Policy",
    documentCode: "POL-001",
    documentVersion: "1.2",
    auditHash: "abc123",
    auditETag: "etag-1",
    attestationText: "I confirm I have read and understood.",
    dwellSeconds: 130,
    sourceItemId: "item-1",
    ...over,
  };
}

describe("IsoAckLog — data path", () => {
  it("renders the ack table when the fetch returns rows", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ acks: [makeAck()], total: 1, page: 1, pageSize: 50 }),
    } as Response);
    render(<IsoAckLog />);
    expect(await screen.findByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Compliance Course")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("POL-001")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("formats dwell seconds as m/s", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        acks: [makeAck({ dwellSeconds: 75 })],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    } as Response);
    render(<IsoAckLog />);
    expect(await screen.findByText("1m 15s")).toBeInTheDocument();
  });

  it("renders — when dwell or version is missing", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        acks: [
          makeAck({ dwellSeconds: null, documentVersion: null, auditHash: null }),
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    } as Response);
    render(<IsoAckLog />);
    await screen.findByText("Privacy Policy");
    // Multiple — em-dashes for missing fields.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("renders the in-range empty state when total=0", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ acks: [], total: 0, page: 1, pageSize: 50 }),
    } as Response);
    render(<IsoAckLog />);
    expect(
      await screen.findByText("No acknowledgements in this range."),
    ).toBeInTheDocument();
  });

  it("paginates when total > pageSize", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ acks: [makeAck()], total: 120, page: 1, pageSize: 50 }),
    } as Response);
    render(<IsoAckLog />);
    expect(await screen.findByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toHaveAttribute(
      "disabled",
    );
    // Next is enabled.
    expect(
      screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("applies the 30d preset and re-fetches with date params", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ acks: [], total: 0, page: 1, pageSize: 50 }),
    } as Response);
    render(<IsoAckLog />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ acks: [], total: 0, page: 1, pageSize: 50 }),
    } as Response);
    fireEvent.click(screen.getByText("Last 30 days"));

    // Verify a follow-up fetch happens with a ?from=&to=... query.
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(1));
    const url = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][0] as string;
    expect(url).toMatch(/from=/);
    expect(url).toMatch(/to=/);
  });
});
