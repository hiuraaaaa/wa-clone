"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Kalau sudah login, langsung lempar ke /chat
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/chat");
      }
    };
    checkSession();
  }, [router]);

  const handleAuth = async (mode) => {
    setErrorMsg("");
    setLoading(true);
    try {
      if (!email || !password) {
        setErrorMsg("Email dan password wajib diisi.");
        return;
      }

      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      }

      // setelah sukses, ke /chat
      router.replace("/chat");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <h1 className="auth-title">Masuk ke WA Realtime</h1>
      <p className="auth-sub">
        Chat real-time multi user. Pakai email apa aja, bisa khusus buat testing juga.
      </p>

      <div className="auth-field">
        <label>Email</label>
        <input
          type="email"
          placeholder="kamu@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="auth-field">
        <label>Password</label>
        <input
          type="password"
          placeholder="minimal 6 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="auth-btn-row">
        <button
          className="btn-primary"
          onClick={() => handleAuth("login")}
          disabled={loading}
        >
          {loading ? "Tunggu..." : "Login"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => handleAuth("register")}
          disabled={loading}
        >
          Register
        </button>
      </div>

      {errorMsg && <div className="auth-error">{errorMsg}</div>}

      <p
        style={{
          marginTop: 14,
          fontSize: 11,
          color: "var(--text-dim)"
        }}
      >
        Tips: buka di 2 browser / HP beda akun buat ngetes realtime bareng teman.
      </p>
    </div>
  );
}
