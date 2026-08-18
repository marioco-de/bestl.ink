import type { DashState, Tenant } from "./types";

export function emptyDash(userButtons: Tenant["dash_user_buttons"] = "anywhere"): DashState {
  return {
    user_buttons: userButtons,
    teams: [],
    active_team_id: null,
    sections: [],
    groups: [],
    widgets: [],
  };
}
