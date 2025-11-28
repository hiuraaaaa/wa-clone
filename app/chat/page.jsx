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
  const bottomRef = useRef(null);

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

    // Realtime
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto scroll bawah
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !user || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        user_id: user.id,
        user_email: user.email,
        content
      });

      if (error) {
        console.error("Error send message", error);
      } else {
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
    return `${hh}.${mm}`;
  };

  const displayName = useMemo(
    () => (user?.email ? user.email.split("@")[0] : "User"),
    [user]
  );

  if (!user) {
    return null; // sementara, lagi redirect
  }

  return (
    <div className="app-root">
      {/* sidebar kiri (1 global room aja dulu) */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="avatar-circle">
              {displayName[0]?.toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {displayName}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-dim)"
                }}
              >
                {user.email}
              </span>
            </div>
          </div>
          <button className="icon-btn" onClick={handleLogout} title="Logout">
            ⬅
          </button>
        </header>

        <div style={{ padding: 12, fontSize: 12, color: "var(--text-dim)" }}>
          <div style={{ marginBottom: 6, fontWeight: 600, color: "#e9edef" }}>
            Rooms
          </div>
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: "#202c33",
              fontSize: 13
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              🌍 Global Room
            </div>
            <div>Semua user gabung di sini.</div>
          </div>
          <p style={{ marginTop: 10 }}>
            Buka di browser lain / device lain, login pakai email lain →
            coba chat bareng buat tes realtime.
          </p>
        </div>
      </aside>

      {/* panel chat kanan */}
      <section className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <div className="avatar-circle">G</div>
            <div className="chat-header-title">
              <span className="chat-header-name">Global Chat</span>
              <span className="chat-header-status">
                Realtime • {messages.length} pesan
              </span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Login sebagai {user.email}
          </div>
        </header>

        <div className="chat-messages">
          {loadingMessages && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-dim)",
                textAlign: "center",
                marginTop: 16
              }}
            >
              Memuat pesan...
            </div>
          )}

          {!loadingMessages && messages.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-dim)",
                textAlign: "center",
                marginTop: 16
              }}
            >
              Belum ada pesan. Kirim sesuatu dulu 👀
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.user_id === user.id;
            return (
              <div
                key={msg.id}
                className={"msg-row " + (isMe ? "me" : "them")}
              >
                <div className="msg-bubble">
                  {!isMe && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        marginBottom: 2,
                        color: "#d1d7db"
                      }}
                    >
                      {msg.user_email.split("@")[0]}
                    </div>
                  )}
                  <div className="msg-text">{msg.content}</div>
                  <div className="msg-meta">{prettyTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-bar">
          <button className="icon-btn" title="Emoji">
            🙂
          </button>
          <button className="icon-btn" title="Attach">
            📎
          </button>
          <button className="icon-btn" title="Mic">
            🎙
          </button>

          <div className="chat-input-inner">
            <input
              placeholder="Ketik pesan..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <button className="send-btn" onClick={handleSend} disabled={sending}>
            ➤
          </button>
        </div>
      </section>
    </div>
  );
}
