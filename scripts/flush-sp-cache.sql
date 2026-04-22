-- Flushes the SharePoint metadata cache. Run after changing SHAREPOINT_SITE_URL
-- (or any time you want to force fresh Graph API calls). The cache rebuilds
-- lazily on next request, so this is always safe.
DELETE FROM "SharePointCache";
