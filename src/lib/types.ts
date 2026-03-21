export interface Profile {
  github_username: string | null;
  linear_email: string | null;
  slack_user_id: string | null;
  slack_token: string | null;
  google_refresh_token: string | null;
}

export interface TodoItem {
  id: string;
  source: "linear" | "slack" | "github" | "calendar" | "clanker";
  source_id: string;
  title: string;
  url: string | null;
  raw_data: string | null;
  created_at: string;
}
