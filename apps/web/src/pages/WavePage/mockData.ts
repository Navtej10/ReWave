import type { ConnectionStatus, CurrentUser, Wave } from "./types";

export const MOCK_WAVES: Wave[] = [
  { id: "wave-1", title: "", blips: [] },
  { id: "wave-2", title: "", blips: [] },
];

export const MOCK_SELECTED_ID = "wave-2";
export const MOCK_STATUS: ConnectionStatus = "connecting";
export const MOCK_USER: CurrentUser = { id: "u-jo", name: "Jo" };
