"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check user
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }
      setUser(data.user);
    };
    init();
  }, [router]);

  // Load messages + profiles + realtime
  useEffect(() => {
    if (!user) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) {
        console.error("Error load messages", error);
      } else {
        setMessages(data || []);

        // Load profiles for all users
        const userIds = [...new Set(data.map((m) => m.user_id))];
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .in("user_id", userIds);

        const profileMap = {};
        profileData?.forEach((p) => {
          profileMap[p.user_id] = p;
        });
        setProfiles(profileMap);
      }
      setLoadingMessages(false);
    };

    loadMessages();

    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          setMessages((prev) => [...prev, payload.new]);

          // Load profile if not exists
          const userId = payload.new.user_id;
          if (!profiles[userId]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", userId)
              .single();

            if (profile) {
              setProfiles((prev) => ({ ...prev, [userId]: profile }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Prevent body scroll when mobile sidebar open
  useEffect(() => {
    if (sidebarOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [sidebarOpen, isMobile]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        user_id: user.id,
        user_email: user.email,
        content,
        type: "text",
      });

      if (!error) {
        setInput("");
        setShowEmojiPicker(false);
      }
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user || uploading) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("chat-uploads")
        .upload(path, file);

      if (uploadError) {
        console.error(uploadError);
        alert("Failed to upload file");
        return;
      }

      // Get public URL
      const { data } = supabase.storage
        .from("chat-uploads")
        .getPublicUrl(path);

      const publicUrl = data.publicUrl;
      const isImage = file.type.startsWith("image/");

      const { error: insertError } = await supabase.from("messages").insert({
        user_id: user.id,
        user_email: user.email,
        type: isImage ? "image" : "file",
        file_url: publicUrl,
        file_name: file.name,
        mime_type: file.type,
        content: isImage ? "[Image]" : `[File: ${file.name}]`,
      });

      if (insertError) {
        console.error(insertError);
        alert("Failed to send message");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const handleEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  const prettyTime = (iso) => {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const displayName = useMemo(
    () => (user?.email ? user.email.split("@")[0] : "User"),
    [user]
  );

  if (!user) return null;

  return (
    <>
      <div style={styles.container}>
        {/* SIDEBAR */}
        <aside
          style={{
            ...styles.sidebar,
            transform: isMobile
              ? sidebarOpen
                ? "translateX(0)"
                : "translateX(-100%)"
              : "translateX(0)",
          }}
        >
          {/* Sidebar Header */}
          <div style={styles.sidebarHeader}>
            <div style={styles.userInfo}>
              <div style={styles.avatarLarge}>
                {displayName[0]?.toUpperCase()}
              </div>
              <div style={styles.userDetails}>
                <span style={styles.userName}>{displayName}</span>
                <span style={styles.userEmail}>{user.email}</span>
              </div>
            </div>
            {isMobile && (
              <button
                style={styles.closeBtn}
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
            )}
          </div>

          {/* Rooms Section */}
          <div style={styles.roomsSection}>
            <div style={styles.roomsLabel}>Chats</div>
            <div style={styles.roomCard}>
              <div style={styles.roomHeader}>
                <div style={styles.roomAvatar}>🌍</div>
                <div style={styles.roomInfo}>
                  <div style={styles.roomName}>Global Chat</div>
                  <div style={styles.roomDesc}>
                    {messages.length} messages
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button style={styles.logoutBtn} onClick={handleLogout}>
            <span style={styles.logoutIcon}>🚪</span>
            <span>Logout</span>
          </button>
        </aside>

        {/* BACKDROP */}
        {isMobile && sidebarOpen && (
          <div style={styles.backdrop} onClick={() => setSidebarOpen(false)} />
        )}

        {/* CHAT PANEL */}
        <main style={styles.chatPanel}>
          {/* Chat Header - FIXED */}
          <header style={styles.chatHeader}>
            <div style={styles.chatHeaderLeft}>
              {isMobile && (
                <button
                  style={styles.menuBtn}
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
              )}
              <div style={styles.chatAvatar}>G</div>
              <div style={styles.chatInfo}>
                <div style={styles.chatName}>Global Chat</div>
                <div style={styles.chatStatus}>
                  {loadingMessages
                    ? "Loading..."
                    : `${messages.length} messages`}
                </div>
              </div>
            </div>
            <div style={styles.chatHeaderRight}>
              <button style={styles.iconBtn}>🔍</button>
              <button style={styles.iconBtn}>⋮</button>
            </div>
          </header>

          {/* Messages Area - SCROLLABLE */}
          <div style={styles.messagesArea}>
            {loadingMessages && (
              <div style={styles.centerText}>
                <div style={styles.loadingSpinner} />
                <p>Loading messages...</p>
              </div>
            )}

            {!loadingMessages && messages.length === 0 && (
              <div style={styles.centerText}>
                <div style={styles.emptyIcon}>💬</div>
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.user_id === user.id;
              const profile = profiles[msg.user_id];
              const username =
                profile?.username || msg.user_email?.split("@")[0] || "user";
              const firstLetter = username[0]?.toUpperCase() || "?";
              const avatarUrl = profile?.avatar_url;

              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  {!isMe && (
                    <div style={styles.messageAvatar}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={username}
                          style={styles.avatarImage}
                        />
                      ) : (
                        firstLetter
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(isMe
                        ? styles.messageBubbleMe
                        : styles.messageBubbleThem),
                    }}
                  >
                    {!isMe && (
                      <div style={styles.messageSender}>{username}</div>
                    )}

                    {/* Message Content */}
                    {msg.type === "image" && msg.file_url ? (
                      <img
                        src={msg.file_url}
                        alt={msg.file_name || "image"}
                        style={styles.messageImage}
                        onClick={() => window.open(msg.file_url, "_blank")}
                      />
                    ) : msg.type === "file" && msg.file_url ? (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.fileLink}
                      >
                        <span style={styles.fileIcon}>📄</span>
                        <span>{msg.file_name || "File"}</span>
                      </a>
                    ) : (
                      <div style={styles.messageText}>{msg.content}</div>
                    )}

                    <div style={styles.messageTime}>
                      {prettyTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar - FIXED */}
          <div style={styles.inputBar}>
            {/* Emoji Picker */}
            <div style={{ position: "relative" }}>
              <button
                style={styles.iconBtn}
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Emoji"
              >
                😊
              </button>

              {showEmojiPicker && (
                <div style={styles.emojiPickerWrapper}>
                  <Picker onEmojiClick={handleEmojiClick} />
                </div>
              )}
            </div>

            {/* File Upload */}
            <button
              style={styles.iconBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Attach file"
            >
              {uploading ? "⏳" : "📎"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />

            <div style={styles.inputWrapper}>
              <input
                style={styles.input}
                placeholder="Type a message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              style={{
                ...styles.sendBtn,
                opacity: input.trim() && !sending ? 1 : 0.5,
              }}
              onClick={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending ? "..." : "➤"}
            </button>
          </div>
        </main>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow: hidden;
        }

        button {
          font-family: inherit;
        }

        input {
          font-family: inherit;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (min-width: 768px) {
          .chat-panel {
            margin-left: 340px !important;
          }
        }

        @media (hover: hover) {
          button:hover:not(:disabled) {
            background-color: rgba(0, 0, 0, 0.05) !important;
          }

          .send-btn:hover:not(:disabled) {
            background-color: #5b5fc7 !important;
          }

          .room-card:hover {
            background-color: #e8eaf6 !important;
          }

          .logout-btn:hover {
            background-color: #f5f5f5 !important;
            border-color: #6366f1 !important;
            color: #6366f1 !important;
          }
        }

        button:active:not(:disabled) {
          transform: scale(0.95);
        }

        input::placeholder {
          color: #9e9e9e;
        }
      `}</style>
    </>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#fafafa",
    position: "relative",
    overflow: "hidden",
  },

  // SIDEBAR
  sidebar: {
    width: 340,
    maxWidth: "85vw",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
  },

  sidebarHeader: {
    padding: "16px",
    backgroundColor: "#f5f5f5",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },

  avatarLarge: {
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 600,
  },

  userDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },

  userName: {
    fontSize: 16,
    fontWeight: 500,
    color: "#212121",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userEmail: {
    fontSize: 13,
    color: "#757575",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  closeBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "transparent",
    color: "#616161",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s",
  },

  roomsSection: {
    flex: 1,
    padding: 16,
    overflowY: "auto",
  },

  roomsLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#757575",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
  },

  roomCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },

  roomHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  roomAvatar: {
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  roomInfo: {
    flex: 1,
    minWidth: 0,
  },

  roomName: {
    fontSize: 16,
    fontWeight: 500,
    color: "#212121",
    marginBottom: 2,
  },

  roomDesc: {
    fontSize: 13,
    color: "#757575",
  },

  logoutBtn: {
    margin: 16,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #e0e0e0",
    backgroundColor: "#ffffff",
    color: "#757575",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    transition: "all 0.2s",
  },

  logoutIcon: {
    fontSize: 18,
  },

  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 999,
    animation: "fadeIn 0.3s ease",
  },

  // CHAT PANEL - FIXED LAYOUT
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    marginLeft: 0,
    height: "100vh",
    overflow: "hidden",
  },

  // CHAT HEADER - FIXED
  chatHeader: {
    height: 60,
    minHeight: 60,
    backgroundColor: "#f5f5f5",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    flexShrink: 0,
    position: "relative",
    zIndex: 10,
  },

  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },

  menuBtn: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "transparent",
    color: "#616161",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  chatAvatar: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 600,
  },

  chatInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },

  chatName: {
    fontSize: 16,
    fontWeight: 500,
    color: "#212121",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  chatStatus: {
    fontSize: 13,
    color: "#757575",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  chatHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },

  iconBtn: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "transparent",
    color: "#616161",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s",
    WebkitTapHighlightColor: "transparent",
  },

  // MESSAGES AREA - SCROLLABLE ONLY
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "20px 16px",
    backgroundColor: "#fafafa",
    position: "relative",
  },

  centerText: {
    textAlign: "center",
    color: "#757575",
    fontSize: 14,
    padding: "40px 20px",
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  loadingSpinner: {
    width: 40,
    height: 40,
    border: "3px solid #e0e0e0",
    borderTopColor: "#6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 16px",
  },

  messageRow: {
    display: "flex",
    marginBottom: 12,
    gap: 8,
  },

  messageAvatar: {
    width: 32,
    height: 32,
    minWidth: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 4,
  },

  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    objectFit: "cover",
  },

  messageBubble: {
    maxWidth: "65%",
    padding: "8px 12px",
    borderRadius: 12,
    position: "relative",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  },

  messageBubbleMe: {
    backgroundColor: "#e8eaf6",
    borderBottomRightRadius: 2,
  },

  messageBubbleThem: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 2,
    border: "1px solid #e0e0e0",
  },

  messageSender: {
    fontSize: 13,
    fontWeight: 600,
    color: "#6366f1",
    marginBottom: 4,
  },

  messageText: {
    fontSize: 14.5,
    color: "#212121",
    lineHeight: 1.4,
    wordWrap: "break-word",
    whiteSpace: "pre-wrap",
  },

  messageImage: {
    maxWidth: 220,
    borderRadius: 12,
    marginTop: 4,
    cursor: "pointer",
    display: "block",
  },

  fileLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    padding: "8px 12px",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    textDecoration: "none",
    color: "#6366f1",
    fontSize: 14,
    fontWeight: 500,
  },

  fileIcon: {
    fontSize: 18,
  },

  messageTime: {
    fontSize: 11,
    color: "#9e9e9e",
    marginTop: 4,
    textAlign: "right",
  },

  // INPUT BAR - FIXED
  inputBar: {
    height: 68,
    minHeight: 68,
    backgroundColor: "#f5f5f5",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderTop: "1px solid #e0e0e0",
    flexShrink: 0,
    position: "relative",
    zIndex: 10,
  },

  emojiPickerWrapper: {
    position: "absolute",
    bottom: 68,
    left: 0,
    zIndex: 1000,
  },

  inputWrapper: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    display: "flex",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 16,
    border: "1px solid #e0e0e0",
  },

  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 15,
    padding: "10px 0",
    backgroundColor: "transparent",
    color: "#212121",
  },

  sendBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#ffffff",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    WebkitTapHighlightColor: "transparent",
    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
  },
};
