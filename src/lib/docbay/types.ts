export type MemberRole = "owner" | "admin" | "member";
export type ResourceType = "document" | "page" | "event" | "contact";
export type EmailProvider = "none" | "emailit_platform" | "emailit_custom" | "smtp";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const FEATURE_KEYS = [
  "emailit_platform",
  "emailit_custom",
  "smtp_email",
  "chat",
  "pdf_analytics",
  "watermarks",
  "webhooks",
  "bulk_links",
  "nda",
  "password_links",
  "one_time_links",
  "brand_custom",
  "page_proxy",
  "notifications",
  "team_goals",
  "link_share_detect",
  "download_control",
  "short_links",
  "qr_codes",
  "targeting",
  "og_previews",
  "public_api",
  "unbranded_redirect",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureMap = Record<FeatureKey, boolean>;

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** Platform subdomain: {subdomain}.bestl.ink */
  subdomain: string;
  /** Primary host used in UI (subdomain host or custom) */
  domain: string;
  /** Optional customer CNAME domain, unique per workspace */
  custom_domain: string;
  custom_domain_connected: boolean;
  domain_connected: boolean;
  is_demo: boolean;
  demo_reset_at: string | null;
  brand_logo_url: string | null;
  brand_color: string;
  brand_company: string;
  created_at: string;
  /** Computed public base URL host */
  public_host: string;
  plan_id: string | null;
  suspended: boolean;
  notes: string;
  dash_user_buttons: "off" | "anywhere" | "above" | "below";
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  subdomain: string;
  role: MemberRole;
}

export interface TenantDomain {
  id: string;
  tenant_id: string;
  host: string;
  connected: boolean;
  dns_ok: boolean;
  tags: string[];
  sort_order: number;
  created_at: string;
}

export interface Member {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  param_button_id: string | null;
  email?: string;
  name?: string;
}

export interface Resource {
  id: string;
  tenant_id: string;
  type: ResourceType;
  title: string;
  slug: string;
  description: string;
  content_url: string | null;
  content_base64: string | null;
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  payload: JsonObject;
  tags: string[];
  allow_download: boolean;
  require_nda: boolean;
  nda_text: string;
  created_at: string;
}

export interface ParamNode {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  kind: "folder" | "button";
  show_on_home: boolean;
  sort_order: number;
}

export interface GeneratedLink {
  id: string;
  tenant_id: string;
  token: string;
  resource_id: string;
  button_id: string;
  created_by: string | null;
  note: string;
  tags: string[];
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  click_count: number;
  human_click_count: number;
  last_clicked_at: string | null;
  revoked: boolean;
  expires_at: string | null;
  one_time: boolean;
  used_at: string | null;
  password_hash: string | null;
  allow_download: boolean | null;
  require_nda: boolean | null;
  created_at: string;
  resource_title?: string;
  resource_slug?: string;
  resource_type?: ResourceType;
  button_name?: string;
  unique_ips?: number;
  share_suspected?: boolean;
}

export interface AccessRequest {
  id: string;
  tenant_id: string;
  resource_id: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  resource_title?: string;
}

export interface EmailSettings {
  tenant_id: string;
  provider: EmailProvider;
  emailit_api_key: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_secure: boolean;
  from_email: string | null;
  from_name: string | null;
}

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  kind: string;
  subject: string;
  body_html: string;
}

export interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  events: string[];
  secret: string | null;
  enabled: boolean;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  meta: Record<string, string | number | boolean | null>;
  created_at: string;
}

export interface TeamGoalRow {
  button_id: string;
  name: string;
  links: number;
  human_clicks: number;
  hot_links: number;
}

export interface ShortLink {
  id: string;
  tenant_id: string;
  slug: string;
  destination: string;
  title: string;
  note: string;
  tags: string[];
  has_password: boolean;
  expires_at: string | null;
  max_clicks: number | null;
  disabled: boolean;
  cloak: boolean;
  ios_url: string | null;
  android_url: string | null;
  geo_rules: Record<string, string>;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  button_id: string | null;
  button_name?: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  click_count: number;
  human_click_count: number;
  last_clicked_at: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  tenant_id: string;
  name: string;
  prefix: string;
  created_at: string;
}

export interface SuperTenantRow {
  tenant: Tenant;
  features: FeatureMap;
  memberCount: number;
  linkCount: number;
  plan_id: string | null;
  plan_name: string | null;
  plan_kind: string | null;
  owners: { user_id: string; email: string; name: string; role: MemberRole }[];
}

export interface SuperUserRow {
  user_id: string;
  email: string;
  name: string;
  is_super_admin: boolean;
  created_at: string;
  workspaces: { tenant_id: string; tenant_name: string; role: MemberRole }[];
}

export interface DashTeam {
  id: string;
  tenant_id: string;
  name: string;
  member_ids: string[];
}

export interface DashSection {
  id: string;
  tenant_id: string;
  team_id: string | null;
  user_id: string | null;
  kind: "team" | "personal";
  zone: "above" | "below" | "personal";
  title: string;
  sort_order: number;
}

export interface DashGroup {
  id: string;
  section_id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashWidget {
  id: string;
  section_id: string;
  group_id: string | null;
  short_id: string | null;
  resource_id: string | null;
  label: string;
  display: "text" | "icon" | "preview";
  icon: string;
  image_url: string | null;
  show_clicks: boolean;
  show_last_click: boolean;
  click_mode: "copy" | "mint";
  x: number;
  y: number;
  w: number;
  h: number;
  created_by: string | null;
}

export interface DashState {
  user_buttons: Tenant["dash_user_buttons"];
  teams: DashTeam[];
  active_team_id: string | null;
  sections: DashSection[];
  groups: DashGroup[];
  widgets: DashWidget[];
}

export interface SuperAdminPayload {
  plans: import("./plans").Plan[];
  tenants: SuperTenantRow[];
  users: SuperUserRow[];
}

export interface FullState {
  tenant: Tenant;
  member: Member;
  features: FeatureMap;
  resources: Resource[];
  params: ParamNode[];
  tags: { id: string; name: string; color: string }[];
  workspaces: WorkspaceSummary[];
  domains: TenantDomain[];
  utmPresets: {
    id: string;
    tenant_id?: string;
    name: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
  }[];
  links: GeneratedLink[];
  requests: AccessRequest[];
  stats: {
    resources: number;
    links: number;
    clicks: number;
    human_clicks: number;
    pending_requests: number;
    buttons: number;
    unread_notifications: number;
    shorts: number;
    short_clicks: number;
  };
  teamGoals: TeamGoalRow[];
  emailSettings: EmailSettings | null;
  emailTemplates: EmailTemplate[];
  webhooks: Webhook[];
  notifications: Notification[];
  audit: AuditEntry[];
  members: Member[];
  shorts: ShortLink[];
  apiKeys: ApiKeyRow[];
  dash: DashState;
  demoResetsInMs: number | null;
  isSuperAdmin: boolean;
  platformTenants?: SuperTenantRow[];
}
