export type ResourceType = "document" | "page";
export type ParamKind = "folder" | "button";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface Settings {
  id: string;
  company_name: string;
  domain: string;
  domain_connected: boolean;
  brand_color: string;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  slug: string;
  description: string;
  content_url: string | null;
  content_base64: string | null;
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface ParamNode {
  id: string;
  parent_id: string | null;
  name: string;
  kind: ParamKind;
  show_on_home: boolean;
  sort_order: number;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface UtmPreset {
  id: string;
  name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  created_at: string;
}

export interface GeneratedLink {
  id: string;
  token: string;
  resource_id: string;
  button_id: string;
  note: string;
  tags: string[];
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  click_count: number;
  last_clicked_at: string | null;
  revoked: boolean;
  created_at: string;
  // joined
  resource_title?: string;
  resource_slug?: string;
  resource_type?: ResourceType;
  button_name?: string;
  button_path?: string;
}

export interface AccessRequest {
  id: string;
  resource_id: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  resource_title?: string;
  resource_slug?: string;
}

export interface PublicResourceView {
  resource: Pick<
    Resource,
    "id" | "type" | "title" | "slug" | "description" | "mime_type" | "file_name"
  >;
  settings: Pick<Settings, "company_name" | "domain" | "brand_color">;
  access: "granted" | "denied" | "missing";
  content_url?: string | null;
  /** data url for documents when granted */
  content_data_url?: string | null;
  target_url?: string | null;
  link?: {
    id: string;
    token: string;
    note: string;
    button_name: string;
  };
}

export interface DashboardStats {
  resources: number;
  links: number;
  clicks: number;
  pending_requests: number;
  buttons: number;
}

export interface FullState {
  settings: Settings;
  resources: Resource[];
  params: ParamNode[];
  tags: Tag[];
  utmPresets: UtmPreset[];
  links: GeneratedLink[];
  requests: AccessRequest[];
  stats: DashboardStats;
}
