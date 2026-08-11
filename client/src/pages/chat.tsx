import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Hash,
  Users,
  MessageSquare,
  Plus,
  Send,
  ArrowLeft,
  Loader2,
  Search,
  AtSign,
  ChevronDown,
  ChevronRight,
  X,
  UserPlus,
  Trash2,
} from "lucide-react";

interface ChatPageProps {
  user: { id: string; name: string; role: string; companyId?: string };
}

interface Channel {
  id: string;
  companyId: string;
  type: "general" | "project" | "dm" | "custom";
  name: string;
  projectId?: string;
  createdById?: string;
  createdAt: string;
  unreadCount: number;
}

interface ChannelMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  userName: string;
  userRole: string;
}

interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  userRole: string;
  joinedAt: string;
}

interface CompanyUser {
  id: string;
  name: string;
  role: string;
}

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  if (diffDays < 7) return `${date.toLocaleDateString([], { weekday: "long" })} at ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Channel Sidebar ───────────────────────────────────────────────────────────

function ChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  onNewDM,
  onCreateChannel,
  user,
  isLoading,
}: {
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onNewDM: () => void;
  onCreateChannel: () => void;
  user: ChatPageProps["user"];
  isLoading: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = {
    general: channels.filter((c) => c.type === "general"),
    project: channels.filter((c) => c.type === "project"),
    dm: channels.filter((c) => c.type === "dm"),
    custom: channels.filter((c) => c.type === "custom"),
  };

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderGroup = (
    label: string,
    key: string,
    items: Channel[],
    icon: React.ReactNode,
    action?: React.ReactNode
  ) => {
    if (items.length === 0 && key !== "dm" && key !== "custom") return null;
    const isCollapsed = collapsed[key];

    return (
      <div key={key} className="mb-1">
        <button
          onClick={() => toggleGroup(key)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span className="flex items-center gap-1">
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {label}
          </span>
          {action}
        </button>
        {!isCollapsed && (
          <div className="space-y-0.5">
            {items.map((ch) => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                isActive={ch.id === activeChannelId}
                onClick={() => onSelectChannel(ch.id)}
                currentUserId={user.id}
              />
            ))}
            {items.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500 italic">None yet</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full md:w-64 bg-slate-800 text-white flex flex-col shrink-0 h-full">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        <h2 className="font-semibold text-sm">Messages</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <>
              {renderGroup("General", "general", grouped.general, <Hash className="w-3 h-3" />)}
              {renderGroup("Projects", "project", grouped.project, <Hash className="w-3 h-3" />)}
              {renderGroup(
                "Direct Messages",
                "dm",
                grouped.dm,
                <AtSign className="w-3 h-3" />,
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewDM();
                  }}
                  className="p-0.5 hover:bg-slate-600 rounded transition-colors"
                  title="New DM"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              {renderGroup(
                "Channels",
                "custom",
                grouped.custom,
                <Hash className="w-3 h-3" />,
                user.role === "admin" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateChannel();
                    }}
                    className="p-0.5 hover:bg-slate-600 rounded transition-colors"
                    title="Create Channel"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ) : undefined
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  currentUserId,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  currentUserId: string;
}) {
  const icon =
    channel.type === "dm" ? (
      <AtSign className="w-4 h-4 text-slate-400 shrink-0" />
    ) : (
      <Hash className="w-4 h-4 text-slate-400 shrink-0" />
    );

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${
        isActive
          ? "bg-[#EF7878] text-white"
          : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
      style={{ width: "calc(100% - 8px)" }}
    >
      {icon}
      <span className="truncate flex-1 text-left">{channel.name}</span>
      {channel.unreadCount > 0 && (
        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
          {channel.unreadCount > 99 ? "99" : channel.unreadCount}
        </span>
      )}
    </button>
  );
}

// ─── Message Pane ──────────────────────────────────────────────────────────────

function MessagePane({
  channel,
  user,
  onBack,
}: {
  channel: Channel | null;
  user: ChatPageProps["user"];
  onBack?: () => void;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showMembers, setShowMembers] = useState(false);

  const channelId = channel?.id;

  const { data: messages = [], isLoading: loadingMessages } = useQuery<ChannelMessage[]>({
    queryKey: [`/api/channels/${channelId}/messages`],
    enabled: !!channelId,
    refetchInterval: 3000,
  });

  const { data: members = [] } = useQuery<ChannelMember[]>({
    queryKey: [`/api/channels/${channelId}/members`],
    enabled: !!channelId && showMembers,
  });

  // Mark channel as read
  const prevMessageCountRef = useRef(0);
  const prevChannelIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset tracking on channel switch
    if (channelId !== prevChannelIdRef.current) {
      prevMessageCountRef.current = 0;
      prevChannelIdRef.current = channelId || null;
      setInput("");
      setShowMembers(false);
    }

    // Mark as read when message count changes
    if (channelId && messages.length > 0 && messages.length !== prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      apiRequest("PUT", `/api/channels/${channelId}/read`).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
        queryClient.invalidateQueries({ queryKey: ["/api/channels/unread"] });
      }).catch(() => {});
    }
  }, [channelId, messages.length, queryClient]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/channels/${channelId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending || !channel) return;
    sendMutation.mutate(input.trim());
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a channel</p>
          <p className="text-sm mt-1">Choose a conversation from the sidebar</p>
        </div>
      </div>
    );
  }

  // Group messages by date separator
  let lastDate = "";

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {channel.type === "dm" ? (
            <AtSign className="w-5 h-5 text-slate-400 shrink-0" />
          ) : (
            <Hash className="w-5 h-5 text-slate-400 shrink-0" />
          )}
          <h3 className="font-semibold text-slate-900 truncate">{channel.name}</h3>
        </div>
        <button
          onClick={() => setShowMembers(!showMembers)}
          className={`p-2 rounded-lg transition-colors ${
            showMembers ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-100 text-slate-400"
          }`}
          title="Members"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-0.5">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Hash className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium">
                    Welcome to #{channel.name}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    This is the start of the conversation.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const msgDate = new Date(msg.createdAt).toLocaleDateString();
                  const showDateSep = msgDate !== lastDate;
                  lastDate = msgDate;

                  // Collapse consecutive messages from same user within 5 min
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const isCollapsed =
                    prev &&
                    prev.userId === msg.userId &&
                    !showDateSep &&
                    new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 300000;

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-slate-200" />
                          <span className="text-[11px] text-slate-400 font-medium">{msgDate}</span>
                          <div className="flex-1 h-px bg-slate-200" />
                        </div>
                      )}
                      <div
                        className={`flex gap-3 hover:bg-slate-50 px-2 py-0.5 rounded-md transition-colors ${
                          isCollapsed ? "" : "mt-3"
                        }`}
                      >
                        {isCollapsed ? (
                          <div className="w-8 shrink-0" />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${getAvatarColor(
                              msg.userName
                            )}`}
                          >
                            {getInitials(msg.userName)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {!isCollapsed && (
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-sm text-slate-900">
                                {msg.userName}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <p className="text-sm text-slate-700 break-words whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message #${channel.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="text-sm"
                autoFocus
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                size="icon"
                className="shrink-0 bg-[#EF7878] hover:bg-[#e05555]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Members Panel */}
        {showMembers && (
          <div className="w-60 border-l border-slate-200 bg-slate-50 shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-slate-200">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Members — {members.length}
              </h4>
            </div>
            <div className="p-2 space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAvatarColor(
                      m.userName
                    )}`}
                  >
                    {getInitials(m.userName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate font-medium">{m.userName}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{m.userRole === "admin" ? "Manager" : m.userRole}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Channel Dialog ─────────────────────────────────────────────────────

function CreateChannelDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ChatPageProps["user"];
}) {
  const [name, setName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["/api/company/users"],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/channels", {
        name: name.trim(),
        memberIds: selectedUsers,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      onOpenChange(false);
      setName("");
      setSelectedUsers([]);
      toast({ title: "Channel created" });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredUsers = companyUsers.filter(
    (u) =>
      u.id !== user.id &&
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Channel Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="e.g. frontend-team"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Add Members</label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="pl-8 text-sm"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                    selectedUsers.includes(u.id) ? "bg-indigo-50" : ""
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getAvatarColor(
                      u.name
                    )}`}
                  >
                    {getInitials(u.name)}
                  </div>
                  <span className="flex-1 text-left truncate">{u.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {u.role === "admin" ? "Manager" : u.role}
                  </span>
                  {selectedUsers.includes(u.id) && (
                    <div className="w-4 h-4 bg-[#EF7878] rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px]">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {selectedUsers.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{selectedUsers.length} selected</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            className="bg-[#EF7878] hover:bg-[#e05555]"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New DM Dialog ─────────────────────────────────────────────────────────────

function NewDMDialog({
  open,
  onOpenChange,
  user,
  onDMCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ChatPageProps["user"];
  onDMCreated: (channelId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["/api/company/users"],
    enabled: open,
  });

  const createDMMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiRequest("POST", "/api/channels/dm", { targetUserId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      onOpenChange(false);
      setSearchTerm("");
      onDMCreated(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredUsers = companyUsers.filter(
    (u) =>
      u.id !== user.id &&
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search people..."
              className="pl-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No users found</p>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => createDMMutation.mutate(u.id)}
                  disabled={createDMMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(
                      u.name
                    )}`}
                  >
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-700">{u.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {u.role === "admin" ? "Manager" : u.role}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Chat Page ────────────────────────────────────────────────────────────

export default function ChatPage({ user }: ChatPageProps) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const isMobile = useIsMobile();

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
    refetchInterval: 10000,
  });

  // Auto-select first channel on load
  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      const general = channels.find((c) => c.type === "general");
      setActiveChannelId(general?.id || channels[0].id);
    }
  }, [channels, activeChannelId]);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;

  const handleSelectChannel = (id: string) => {
    setActiveChannelId(id);
    if (isMobile) setShowSidebar(false);
  };

  const handleDMCreated = (channelId: string) => {
    setActiveChannelId(channelId);
    if (isMobile) setShowSidebar(false);
  };

  // Mobile: show sidebar or message pane
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col">
        {showSidebar ? (
          <ChannelSidebar
            channels={channels}
            activeChannelId={activeChannelId}
            onSelectChannel={handleSelectChannel}
            onNewDM={() => setShowNewDM(true)}
            onCreateChannel={() => setShowCreateChannel(true)}
            user={user}
            isLoading={loadingChannels}
          />
        ) : (
          <MessagePane
            channel={activeChannel}
            user={user}
            onBack={() => setShowSidebar(true)}
          />
        )}
        <NewDMDialog
          open={showNewDM}
          onOpenChange={setShowNewDM}
          user={user}
          onDMCreated={handleDMCreated}
        />
        <CreateChannelDialog
          open={showCreateChannel}
          onOpenChange={setShowCreateChannel}
          user={user}
        />
      </div>
    );
  }

  // Desktop: side-by-side
  return (
    <div className="h-[calc(100vh-56px)] flex">
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        onNewDM={() => setShowNewDM(true)}
        onCreateChannel={() => setShowCreateChannel(true)}
        user={user}
        isLoading={loadingChannels}
      />
      <MessagePane channel={activeChannel} user={user} />
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        user={user}
        onDMCreated={handleDMCreated}
      />
      <CreateChannelDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        user={user}
      />
    </div>
  );
}
