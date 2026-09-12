import { assertAppDataServerOnly } from "./server-only";

assertAppDataServerOnly("app-data/client.server");

export function isConnectorTokenReady(): boolean {
  return true;
}
