"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html>
      <body>
        <title>Something went wrong — Teams Squared LMS</title>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            textAlign: "center",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            backgroundColor: "#f5f5f8",
            color: "#0f0f14",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.5rem", maxWidth: "24rem" }}>
            A critical error occurred. You can try again, or reload the page.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "#7c3aed",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#9ca3af" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
