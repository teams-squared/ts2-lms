import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let _client: Client | null = null;

export function getGraphClient(): Client {
  if (_client) return _client;

  const missing = (
    ["SHAREPOINT_TENANT_ID", "SHAREPOINT_CLIENT_ID", "SHAREPOINT_CLIENT_SECRET"] as const
  ).filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET."
    );
  }

  const credential = new ClientSecretCredential(
    process.env.SHAREPOINT_TENANT_ID!,
    process.env.SHAREPOINT_CLIENT_ID!,
    process.env.SHAREPOINT_CLIENT_SECRET!
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  _client = Client.initWithMiddleware({ authProvider });
  return _client;
}
