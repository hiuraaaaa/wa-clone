"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // 'login' or 'register'

  // LOGIN
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  // REGISTER
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loadingRegister, setLoadingRegister] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/chat");
      }
    };
    checkSession();
  }, [router]);

  // Clear error when switching modes
  useEffect(() => {
    setErrorMsg("");
  }, [mode]);

  // REGISTER HANDLER
  const handleRegister = async () => {
    setErrorMsg("");
    setLoadingRegister(true);
    try {
      if (!regUsername || !regEmail || !regPassword) {
        setErrorMsg("All fields are required.");
        return;
      }

      if (regPassword.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }

      // Check if username exists
      const { data: existing, error: existingErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", regUsername)
        .maybeSingle();

      if (existingErr && existingErr.code !== "PGRST116") {
        throw existingErr;
      }

      if (existing) {
        setErrorMsg("Username already taken. Try another one.");
        return;
      }

      // Sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
      });

      if (signUpError) throw signUpError;

      const userId = data.user?.id;
      if (userId) {
        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: userId,
          username: regUsername,
          email: regEmail,
        });

        if (profileError) throw profileError;
      }

      router.replace("/chat");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Registration failed. Please try again.");
    } finally {
      setLoadingRegister(false);
    }
  };

  // LOGIN HANDLER
  const handleLogin = async () => {
    setErrorMsg("");
    setLoadingLogin(true);
    try {
      if (!loginId || !loginPassword) {
        setErrorMsg("Please enter username/email and password.");
        return;
      }

      let emailToUse = loginId;

      // If no '@', assume it's a username
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
          setErrorMsg("Username not found.");
          return;
        }

        emailToUse = profile.email;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginPassword,
      });

      if (loginError) throw loginError;

      router.replace("/chat");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoadingLogin(false);
    }
  };

  return (
    <>
      <div style={styles.container}>
        <div style={styles.card}>
          {/* HEADER */}
          <div style={styles.header}>
            <div style={styles.logoContainer}>
              <div style={styles.logo}>💬</div>
            </div>
            <h1 style={styles.title}>WhatsApp Chat</h1>
            <p style={styles.subtitle}>
              Connect with friends and family instantly
            </p>
          </div>

          {/* TAB SWITCHER */}
          <div style={styles.tabContainer}>
            <button
              style={{
                ...styles.tab,
                ...(mode === "login" ? styles.tabActive : {}),
              }}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              style={{
                ...styles.tab,
                ...(mode === "register" ? styles.tabActive : {}),
              }}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          {/* ERROR MESSAGE */}
          {errorMsg && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Username or Email</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Enter your username or email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              <button
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  opacity: loadingLogin ? 0.6 : 1,
                }}
                onClick={handleLogin}
                disabled={loadingLogin}
              >
                {loadingLogin ? "Logging in..." : "Login"}
              </button>

              <p style={styles.hint}>
                Don't have an account?{" "}
                <span
                  style={styles.link}
                  onClick={() => setMode("register")}
                >
                  Register here
                </span>
              </p>
            </div>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Username</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Choose a unique username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="Enter your email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                />
              </div>

              <button
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  opacity: loadingRegister ? 0.6 : 1,
                }}
                onClick={handleRegister}
                disabled={loadingRegister}
              >
                {loadingRegister ? "Creating account..." : "Create Account"}
              </button>

              <p style={styles.hint}>
                Already have an account?{" "}
                <span
                  style={styles.link}
                  onClick={() => setMode("login")}
                >
                  Login here
                </span>
              </p>
            </div>
          )}

          {/* FOOTER INFO */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              💡 Tip: You can login using either your username or email
            </p>
          </div>
        </div>
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }

        button {
          font-family: inherit;
        }

        input {
          font-family: inherit;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `}</style>
    </>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    overflow: "hidden",
    animation: "slideIn 0.5s ease",
  },

  header: {
    padding: "40px 32px 32px",
    textAlign: "center",
    background: "linear-gradient(135deg, #00a884 0%, #008069 100%)",
    color: "#ffffff",
  },

  logoContainer: {
    marginBottom: 16,
  },

  logo: {
    fontSize: 48,
    display: "inline-block",
    animation: "bounce 2s infinite",
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    opacity: 0.95,
    margin: 0,
  },

  tabContainer: {
    display: "flex",
    backgroundColor: "#f0f2f5",
    padding: 4,
    margin: "0 32px",
    borderRadius: 12,
    marginTop: -20,
    position: "relative",
    zIndex: 1,
  },

  tab: {
    flex: 1,
    padding: "12px 20px",
    border: "none",
    backgroundColor: "transparent",
    color: "#667781",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    borderRadius: 10,
    transition: "all 0.3s ease",
    WebkitTapHighlightColor: "transparent",
  },

  tabActive: {
    backgroundColor: "#ffffff",
    color: "#00a884",
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },

  errorBox: {
    margin: "24px 32px 0",
    padding: "12px 16px",
    backgroundColor: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: 12,
    color: "#856404",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    animation: "shake 0.5s ease",
  },

  errorIcon: {
    fontSize: 18,
  },

  form: {
    padding: "24px 32px 32px",
  },

  formGroup: {
    marginBottom: 20,
  },

  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#111b21",
    marginBottom: 8,
  },

  input: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    border: "2px solid #e9edef",
    borderRadius: 12,
    outline: "none",
    transition: "all 0.2s ease",
    color: "#111b21",
    backgroundColor: "#ffffff",
  },

  button: {
    width: "100%",
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
    WebkitTapHighlightColor: "transparent",
  },

  buttonPrimary: {
    backgroundColor: "#00a884",
    color: "#ffffff",
    boxShadow: "0 4px 12px rgba(0,168,132,0.3)",
  },

  hint: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 14,
    color: "#667781",
  },

  link: {
    color: "#00a884",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
  },

  footer: {
    padding: "16px 32px",
    backgroundColor: "#f0f2f5",
    borderTop: "1px solid #e9edef",
  },

  footerText: {
    fontSize: 13,
    color: "#667781",
    textAlign: "center",
    margin: 0,
  },
};

// Add bounce animation
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    input:focus {
      border-color: #00a884 !important;
      box-shadow: 0 0 0 3px rgba(0,168,132,0.1) !important;
    }
    
    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,168,132,0.4) !important;
    }
    
    button:active:not(:disabled) {
      transform: translateY(0);
    }
    
    button:disabled {
      cursor: not-allowed;
    }
    
    .tab:hover {
      background-color: rgba(0,168,132,0.05);
    }
    
    .link:hover {
      opacity: 0.8;
    }
    
    @media (max-width: 480px) {
      .card {
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      
      .header {
        padding: 32px 24px 24px !important;
      }
      
      .form {
        padding: 20px 24px 24px !important;
      }
      
      .tabContainer {
        margin: 0 24px !important;
      }
      
      .errorBox {
        margin: 20px 24px 0 !important;
      }
    }
  `;
  document.head.appendChild(styleSheet);
    }
