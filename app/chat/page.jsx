"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cek user
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

  // Load pesan awal + realtime subscription
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
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
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
      });

      if (!error) {
        setInput("");
      }
    } finally {
      setSending(false);
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
          <div
            style={styles.backdrop}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* CHAT PANEL */}
        <main style={styles.chatPanel}>
          {/* Chat Header */}
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

          {/* Messages Area */}
          <div style={styles.messagesArea}>
            {loadingMessages && (
              <div style={styles.centerText}>Loading messages...</div>
            )}

            {!loadingMessages && messages.length === 0 && (
              <div style={styles.centerText}>
                <div style={styles.emptyIcon}>💬</div>
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.user_id === user.id;
              const username = msg.user_email?.split("@")[0] || "user";
              const firstLetter = username[0]?.toUpperCase() || "?";

              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  {!isMe && (
                    <div style={styles.messageAvatar}>{firstLetter}</div>
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
                    <div style={styles.messageText}>{msg.content}</div>
                    <div style={styles.messageTime}>
                      {prettyTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <div style={styles.inputBar}>
            <button style={styles.iconBtn}>😊</button>
            <button style={styles.iconBtn}>📎</button>
            
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
      `}</style>
    </>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#f0f2f5",
    position: "relative",
    overflow: "hidden",
  },

  // SIDEBAR
  sidebar: {
    width: 340,
    maxWidth: "85vw",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e9edef",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "2px 0 8px rgba(0,0,0,0.08)",
  },

  sidebarHeader: {
    padding: "16px",
    backgroundColor: "#f0f2f5",
    borderBottom: "1px solid #e9edef",
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
    backgroundColor: "#00a884",
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
    color: "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userEmail: {
    fontSize: 13,
    color: "#667781",
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
    color: "#54656f",
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
    color: "#667781",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
  },

  roomCard: {
    backgroundColor: "#f0f2f5",
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
    color: "#111b21",
    marginBottom: 2,
  },

  roomDesc: {
    fontSize: 13,
    color: "#667781",
  },

  logoutBtn: {
    margin: 16,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #e9edef",
    backgroundColor: "#ffffff",
    color: "#667781",
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

  // BACKDROP
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 999,
    animation: "fadeIn 0.3s ease",
  },

  // CHAT PANEL
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    marginLeft: 0,
    position: "relative",
  },

  chatHeader: {
    height: 60,
    backgroundColor: "#f0f2f5",
    borderBottom: "1px solid #e9edef",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    flexShrink: 0,
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
    color: "#54656f",
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
    backgroundColor: "#00a884",
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
    color: "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  chatStatus: {
    fontSize: 13,
    color: "#667781",
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
    color: "#54656f",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s",
    WebkitTapHighlightColor: "transparent",
  },

  // MESSAGES AREA
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px 80px",
    backgroundColor: "#efeae2",
    backgroundImage:
      "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h100v100H0z\" fill=\"%23efeae2\"/%3E%3C/svg%3E')",
  },

  centerText: {
    textAlign: "center",
    color: "#667781",
    fontSize: 14,
    padding: "40px 20px",
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
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
    backgroundColor: "#d1d7db",
    color: "#54656f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 4,
  },

  messageBubble: {
    maxWidth: "65%",
    padding: "8px 12px",
    borderRadius: 8,
    position: "relative",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },

  messageBubbleMe: {
    backgroundColor: "#d9fdd3",
    borderBottomRightRadius: 2,
  },

  messageBubbleThem: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 2,
  },

  messageSender: {
    fontSize: 13,
    fontWeight: 600,
    color: "#00a884",
    marginBottom: 4,
  },

  messageText: {
    fontSize: 14.5,
    color: "#111b21",
    lineHeight: 1.4,
    wordWrap: "break-word",
    whiteSpace: "pre-wrap",
  },

  messageTime: {
    fontSize: 11,
    color: "#667781",
    marginTop: 4,
    textAlign: "right",
  },

  // INPUT BAR
  inputBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f0f2f5",
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderTop: "1px solid #e9edef",
  },

  inputWrapper: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    display: "flex",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 16,
  },

  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 15,
    padding: "10px 0",
    backgroundColor: "transparent",
    color: "#111b21",
  },

  sendBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#00a884",
    color: "#ffffff",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    WebkitTapHighlightColor: "transparent",
  },
};

// Add media queries and animations
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @media (min-width: 768px) {
      .chat-panel {
        margin-left: 340px !important;
      }
    }
    
    @media (hover: hover) {
      button:hover {
        background-color: rgba(0,0,0,0.05) !important;
      }
      
      .send-btn:hover:not(:disabled) {
        background-color: #06cf9c !important;
      }
      
      .room-card:hover {
        background-color: #e9edef !important;
      }
      
      .logout-btn:hover {
        background-color: #f0f2f5 !important;
        border-color: #00a884 !important;
        color: #00a884 !important;
      }
    }
    
    button:active {
      transform: scale(0.95);
    }
    
    input::placeholder {
      color: #8696a0;
    }
  `;
  document.head.appendChild(styleSheet);
    }
