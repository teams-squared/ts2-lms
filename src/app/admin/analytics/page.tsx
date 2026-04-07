export default function AnalyticsPage() {
  const embedUrl = process.env.POSTHOG_DASHBOARD_EMBED_URL;

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        className="w-full rounded-lg border border-gray-200/60 shadow-card"
        style={{ height: "calc(100vh - 180px)" }}
        allow="fullscreen"
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200/60 bg-white shadow-card p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Connect your PostHog Dashboard
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Embed your PostHog analytics dashboard here so admins can view site
        activity without leaving the portal.
      </p>

      <ol className="space-y-3 text-sm text-gray-700">
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
            1
          </span>
          <span>Open your PostHog project.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
            2
          </span>
          <span>
            Go to <strong>Dashboards</strong> and open or create a dashboard.
            <br />
            <span className="text-gray-400 text-xs">
              Suggested insights: Page views trend · Unique users · Top
              documents viewed · Searches performed
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
            3
          </span>
          <span>
            Click <strong>Share</strong> (top-right of the dashboard) and toggle{" "}
            <strong>Enable sharing</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
            4
          </span>
          <span>
            Copy the <strong>Embed URL</strong> — it starts with{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
              https://us.posthog.com/embedded/…
            </code>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
            5
          </span>
          <span>
            Add to your <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">.env.local</code>:
            <br />
            <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1">
              POSTHOG_DASHBOARD_EMBED_URL=https://us.posthog.com/embedded/…
            </code>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
            6
          </span>
          <span>Restart the dev server — your live dashboard will appear here.</span>
        </li>
      </ol>
    </div>
  );
}
