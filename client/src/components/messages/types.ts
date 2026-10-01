import { useEffect, useState } from "react";

export type ChannelType = "general" | "project" | "dm" | "custom";

export interface Channel {
  id: string;
  companyId: string;
  type: ChannelType;
  name: string;
  projectId?: string | null;
  createdById?: string | null;
  createdAt: string;
  unreadCount: number;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  userName: string;
  userRole?: string;
  // Client-only: set on the optimistic copy while the POST is in flight.
  pending?: boolean;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  userRole: string;
  joinedAt: string;
}

export interface CompanyUser { id: string; name: string; role: string }

export const CHANNELS_KEY = ["/api/channels"] as const;
export const UNREAD_KEY = ["/api/channels/unread"] as const;
// Single-string keys so invalidating ["/api/channels"] (the list) never
// sweeps every conversation's messages along with it.
export const messagesKey = (channelId: string) => [`/api/channels/${channelId}/messages`] as const;
export const membersKey = (channelId: string) => [`/api/channels/${channelId}/members`] as const;

export function channelHref(id: string): string { return `/messages/${id}`; }

export function roleLabel(role: string | undefined): string {
  if (role === "admin") return "Manager";
  if (role === "intern") return "Intern";
  if (role === "system") return "System";
  return role ?? "";
}

export function channelKindLabel(type: ChannelType): string {
  switch (type) {
    case "general": return "Everyone in the workspace";
    case "project": return "Project channel";
    case "dm": return "Direct message";
    default: return "Channel";
  }
}

// Polling is only worth paying for while someone can see the result.
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

// DM channels are stored as "Name A, Name B". Show the other participant.
export function dmDisplayName(channelName: string, selfName: string | undefined): string {
  if (!selfName) return channelName;
  const parts = channelName.split(",").map((p) => p.trim()).filter(Boolean);
  const others = parts.filter((p) => p !== selfName);
  return others.length > 0 ? others.join(", ") : channelName;
}
