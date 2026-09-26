import { useState } from "react";

export type ConnectorWaitStatus = "ready" | "pending" | "idle";

export function useRefetchWhenConnectorReady(refetch?: () => void) {
  const [status] = useState<ConnectorWaitStatus>("ready");
  return { status };
}
