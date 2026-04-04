import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

const REQUIRED_VARS = [
  "SHAREPOINT_TENANT_ID",
  "SHAREPOINT_CLIENT_ID",
  "SHAREPOINT_CLIENT_SECRET",
] as const;

for (const v of REQUIRED_VARS) {
  if (!process.env[v]) {
    throw new Error(
      `Missing required environment variable: ${v}. ` +
        "Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET."
    );
  }
}

let _client: Client | null = null;

export function getGraphClient(): Client {
  if (_client) return _client;

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
