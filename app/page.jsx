"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();

  // LOGIN
  const [loginId, setLoginId] = useState(""); // username ATAU email
  const [loginPassword, setLoginPassword] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  // REGISTER
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loadingRegister, setLoadingRegister] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  // kalau sudah login, langsung masuk /chat
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/chat");
      }
    };
    checkSession();
  }, [router]);

  // ---------- REGISTER: username + email + password ----------
  const handleRegister = async () => {
    setErrorMsg("");
    setLoadingRegister(true);
    try {
      if (!regUsername || !regEmail || !regPassword) {
        setErrorMsg("Username, email, dan password wajib diisi.");
        return;
      }

      // cek username sudah dipakai atau belum
      const { data: existing, error: existingErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", regUsername)
        .maybeSingle();

      if (existingErr && existingErr.code !== "PGRST116") {
        // kode "PGRST116" biasanya "No rows found"
        throw existingErr;
      }

      if (existing) {
        setErrorMsg("Username sudah dipakai, coba yang lain.");
        return;
      }

      // daftar ke auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword
      });

      if (signUpError) throw signUpError;

      const userId = data.user?.id;
      if (userId) {
        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: userId,
          username: regUsername,
          email: regEmail
        });

        if (profileError) throw profileError;
      }

      // langsung masuk ke /chat
      router.replace("/chat");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Terjadi kesalahan saat registrasi.");
    } finally {
      setLoadingRegister(false);
    }
  };

  // ---------- LOGIN: username ATAU email + password ----------
  const handleLogin = async () => {
    setErrorMsg("");
    setLoadingLogin(true);
    try {
      if (!loginId || !loginPassword) {
        setErrorMsg("Isi username/email dan password.");
        return;
      }

      let emailToUse = loginId;

      // kalau input TIDAK mengandung '@' → anggap ini username
      if (!loginId.includes("@")) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", loginId)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (!profile) {
          setErrorMsg("Username tidak ditemukan.");
          return;
        }

        emailToUse = profile.email;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginPassword
      });

      if (loginError) throw loginError;

      router.replace("/chat");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Gagal login, cek lagi datanya.");
    } finally {
      setLoadingLogin(false);
    }
  };

  return (
    <div className="auth-page">
      <h1 className="auth-title">WA Realtime Chat</h1>
      <p className="auth-sub">
        Register pakai username + email. Login bisa pakai username atau email.
      </p>

      {/* --- LOGIN SECTION --- */}
      <div
        style={{
          borderRadius: 16,
          padding: 14,
          border: "1px solid #202c33",
          marginBottom: 14
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 14
          }}
        >
          Login
        </h2>

        <div className="auth-field">
          <label>Username atau Email</label>
          <input
            type="text"
            placeholder="contoh: robin atau robin@example.com"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <label>Password</label>
          <input
            type="password"
            placeholder="password kamu"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button
          className="btn-primary"
          style={{ marginTop: 8, width: "100%" }}
          onClick={handleLogin}
          disabled={loadingLogin}
        >
          {loadingLogin ? "Masuk..." : "Login"}
        </button>
      </div>

      {/* --- REGISTER SECTION --- */}
      <div
        style={{
          borderRadius: 16,
          padding: 14,
          border: "1px solid #202c33"
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 14
          }}
        >
          Register
        </h2>

        <div className="auth-field">
          <label>Username</label>
          <input
            type="text"
            placeholder="username unik kamu"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="auth-field">
          <label>Email</label>
          <input
            type="email"
            placeholder="email kamu"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label>Password</label>
          <input
            type="password"
            placeholder="minimal 6 karakter"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <button
          className="btn-ghost"
          style={{ marginTop: 8, width: "100%" }}
          onClick={handleRegister}
          disabled={loadingRegister}
        >
          {loadingRegister ? "Mendaftar..." : "Register"}
        </button>
      </div>

      {errorMsg && <div className="auth-error">{errorMsg}</div>}

      <p
        style={{
          marginTop: 12,
          fontSize: 11,
          color: "var(--text-dim)"
        }}
      >
        Tips: login bisa pakai <b>username</b> (tanpa @) atau langsung pakai{" "}
        <b>email</b> yang didaftarkan.
      </p>
    </div>
  );
}
