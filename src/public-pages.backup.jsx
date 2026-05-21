/*
  Backup of public pages from `src/App.jsx`.
  Date: 2026-03-11

  This file is not imported anywhere. It exists only so you can quickly restore
  the old public UI if needed.
*/

// ── Landing page (public homepage) ───────────────────────────────────────────────
function LandingPage_BACKUP() {
  const go = (path) => {
    try {
      window.location.href = path;
    } catch {
      window.location.assign(path);
    }
  };

  return (
    <div className="landing">
      <div className="landing-top">
        <div className="container">
          <div className="landing-nav">
            <div className="brandmark" role="banner" aria-label="Shiromani Printers">
              <div className="brandmark-badge"><Icon name="printer" size={18} color="#fff" /></div>
              <div>
                <div style={{ color: "#fff" }}>Shiromani Printers</div>
                <div style={{ fontSize: 12, color: "rgba(226,232,240,.72)", fontWeight: 800 }}>PrintMaster Pro</div>
              </div>
            </div>
            <div className="landing-actions">
              <button className="landing-btn" onClick={() => go("/login")}>Login</button>
              <button className="landing-btn primary" onClick={() => go("/register")}>Start free</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="hero">
          <div className="hero-banner">
            <div className="hero-inner">
              <div className="hero-grid">
                <div>
                  <h1>Billing & inventory for every business.</h1>
                  <p>
                    Create professional invoices in seconds, track payments, manage customers, and share invoices on WhatsApp/email — all inside
                    <b> PrintMaster Pro</b>.
                  </p>
                  <div className="hero-cta">
                    <button className="landing-btn primary" onClick={() => go("/register")}>Start 14‑day free trial</button>
                    <button className="landing-btn" onClick={() => go("/login")}>Login</button>
                  </div>
                  <div className="hero-kpis">
                    <div className="kpi"><div className="n">Fast</div><div className="t">Create bill + share in 1 minute</div></div>
                    <div className="kpi"><div className="n">Reliable</div><div className="t">Cloud backups with Supabase</div></div>
                    <div className="kpi"><div className="n">Automated</div><div className="t">Email + WhatsApp sending</div></div>
                  </div>
                </div>

                <div className="hero-device" aria-label="Product screenshot">
                  <div className="hero-device-top">
                    <div className="hero-chip">
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
                      Payment successful
                    </div>
                    <div style={{ fontWeight: 900, color: "rgba(226,232,240,.86)", fontSize: 12 }}>Works on mobile</div>
                  </div>
                  <div className="hero-screen">
                    <img src="/hero-billing.svg" alt="App preview" />
                  </div>
                  <div className="hero-screen-overlay">Invoice • QR • WhatsApp</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>Everything you need in one app</h2>
          <div className="muted">Simple, fast, and made for daily billing — retail, services, manufacturing, and more.</div>
          <div className="feature-grid">
            <div className="feature"><div className="h">Invoices & GST</div><div className="d">Auto invoice number, GST toggle, due date, notes, and printable A4 invoice.</div></div>
            <div className="feature"><div className="h">Customers</div><div className="d">All customers are saved automatically from bills, with phone & email.</div></div>
            <div className="feature"><div className="h">Payments</div><div className="d">Record partial payments, methods, and auto “payment received” messages.</div></div>
            <div className="feature"><div className="h">Tasks</div><div className="d">Assign work to workers/vendors and track status.</div></div>
            <div className="feature"><div className="h">Reports</div><div className="d">Revenue, pending dues, paid/unpaid bills, and more.</div></div>
            <div className="feature"><div className="h">Cloud & Security</div><div className="d">Supabase backend, OTP login option, and role-based access.</div></div>
          </div>
        </div>

        <div className="section">
          <h2>Simple pricing</h2>
          <div className="muted">Start small and scale.</div>
          <div className="pricing">
            <div className="plan">
              <div className="name">Starter</div>
              <div className="price">₹30 / month</div>
              <div className="muted">For first 6 months</div>
              <ul>
                <li>Unlimited bills</li>
                <li>Email + WhatsApp invoice sending</li>
                <li>Customer list + reports</li>
              </ul>
              <div className="hero-cta">
                <button className="landing-btn primary" onClick={() => go("/register")}>Start Starter</button>
              </div>
            </div>
            <div className="plan best">
              <div className="name">Pro</div>
              <div className="price">₹199 / month</div>
              <div className="muted">After 6 months</div>
              <ul>
                <li>Everything in Starter</li>
                <li>Workers + vendors workflow</li>
                <li>Payment reminders</li>
              </ul>
              <div className="hero-cta">
                <button className="landing-btn primary" onClick={() => go("/register")}>Start Pro</button>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>FAQ</h2>
          <div className="faq">
            <details>
              <summary>Will customers receive invoice on WhatsApp automatically?</summary>
              <div className="muted" style={{ marginTop: 8 }}>Yes, when the customer phone is a valid WhatsApp number and your Infobip setup is enabled.</div>
            </details>
            <details>
              <summary>Can I use it on mobile?</summary>
              <div className="muted" style={{ marginTop: 8 }}>Yes. It’s built as a fast web app and works well on phones and tablets.</div>
            </details>
            <details>
              <summary>Can I print invoices?</summary>
              <div className="muted" style={{ marginTop: 8 }}>Yes — A4 print layout is included.</div>
            </details>
          </div>
        </div>

        <div className="footer">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div><b>Shiromani Printers</b> • PrintMaster Pro</div>
            <div style={{ opacity: .9 }}>© {new Date().getFullYear()} • `shiromani.xyz`</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Org Registration (public, ?register) ───────────────────────────────────────
function OrgRegistrationPage_BACKUP({ showToast }) {
  const [form, setForm] = useState({
    name: "", shopName: "", logo: "", address: "", phone: "",
    adminUsername: "", adminPassword: "", adminName: "", adminEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleLogoFile = async (e) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        const dataUrl = await readFile64(f);
        setForm(prev => ({ ...prev, logo: dataUrl }));
      } catch (err) {
        showToast("Failed to read image", "error");
      }
    }
  };

  const submit = async () => {
    if (!form.name?.trim() || !form.adminUsername?.trim() || !form.adminPassword?.trim()) {
      showToast("Organisation name, admin username and password are required", "error");
      return;
    }
    if (!form.adminEmail?.trim()) {
      showToast("Admin email is required for OTP login and password reset", "error");
      return;
    }
    if (form.adminPassword.length < 4) {
      showToast("Password must be at least 4 characters", "error");
      return;
    }
    setLoading(true);
    try {
      const org = await db.addOrganisation({
        name: form.name.trim(),
        shopName: form.shopName.trim() || null,
        logo: form.logo || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      });
      await db.addOrgAdmin(org.id, {
        username: form.adminUsername.trim(),
        password: form.adminPassword,
        name: form.adminName.trim() || form.adminUsername.trim(),
        email: form.adminEmail.trim() || null,
      });
      setDone(true);
      showToast("Registration submitted. You will be notified when approved.");
    } catch (err) {
      showToast(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ padding: 32, textAlign: "center" }}>
          <div className="login-header-wrap">
            <div className="login-logo-placeholder"><Icon name="check" size={28} color="#fff" /></div>
            <h2 className="login-shop-name">Registration Submitted</h2>
            <p className="login-subtitle">Your organisation is pending approval. You will be able to log in once approved.</p>
          </div>
          <a href={window.location.pathname} className="btn btn-primary" style={{ marginTop: 20 }}>Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 440, padding: 28 }}>
        <div className="login-header-wrap">
          <h2 className="login-shop-name">Register Your Organisation</h2>
          <p className="login-subtitle">Fill in your business details. An admin will approve your registration.</p>
        </div>
        <div className="form-grid" style={{ marginTop: 20 }}>
          <div className="form-group full"><label>Organisation Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Printers" /></div>
          <div className="form-group full"><label>Shop / Company Name</label><input value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} placeholder="Optional" /></div>
          <div className="form-group full"><label>Logo (URL or upload)</label><input value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="https://... or upload below" /><input type="file" accept="image/*" onChange={handleLogoFile} style={{ marginTop: 6, fontSize: ".8rem" }} /></div>
          <div className="form-group full"><label>Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Optional" /></div>
          <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></div>
          <div className="form-group full" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}><label style={{ color: "var(--accent)" }}>Admin (you)</label></div>
          <div className="form-group"><label>Username *</label><input value={form.adminUsername} onChange={e => setForm({ ...form, adminUsername: e.target.value })} placeholder="Login username" /></div>
          <div className="form-group"><label>Password *</label><input type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="Min 4 characters" /></div>
          <div className="form-group"><label>Your Name</label><input value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} placeholder="Optional" /></div>
          <div className="form-group"><label>Email</label><input type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} placeholder="Optional" /></div>
        </div>
        <div className="modal-footer" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <a href={window.location.pathname} className="btn btn-ghost">Back to Login</a>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit Registration"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Login (single page for everyone) ──────────────────────────────────────────
function LoginPage_BACKUP({ brand, adminPassword, onLogin }) {
  const [mode, setMode] = useState("username"); // username | email
  const [form, setForm] = useState({ username: "", password: "" });
  const [emailAuth, setEmailAuth] = useState({ email: "", otp: "", step: "enterEmail" }); // enterEmail | enterOtp
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState({ open: false, email: "", otp: "", step: "enterEmail", newPass: "" }); // enterEmail | enterOtp | setPass
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [titleOffset, setTitleOffset] = useState({ x: 0, y: 0 });
  const pageRef = useRef(null);
  const btnRef = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => {
    const el = pageRef.current;
    const btn = btnRef.current;
    const titleEl = titleRef.current;
    if (!el) return;
    const onMove = (e) => {
      setCursorVisible(true);
      setMouse({ x: e.clientX, y: e.clientY });
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = (e.clientX - centerX) * 0.06;
        const dy = (e.clientY - centerY) * 0.06;
        setBtnOffset({ x: Math.max(-12, Math.min(12, dx)), y: Math.max(-8, Math.min(8, dy)) });
      }
      if (titleEl) {
        const rect = titleEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = (e.clientX - centerX) * 0.028;
        const dy = (e.clientY - centerY) * 0.028;
        setTitleOffset({ x: Math.max(-14, Math.min(14, dx)), y: Math.max(-10, Math.min(10, dy)) });
      }
    };
    const onLeave = () => { setBtnOffset({ x: 0, y: 0 }); setTitleOffset({ x: 0, y: 0 }); setCursorVisible(false); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);

  const go = async () => {
    setLoading(true);
    setErr("");
    try {
      const u = await db.loginWithCredentials(form.username, form.password, adminPassword);
      if (u) {
        onLogin(u);
      } else {
        setErr("Invalid credentials, or your organisation is locked.");
      }
    } catch (e) {
      setErr(e.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    const email = (emailAuth.email || "").trim().toLowerCase();
    if (!email) return setErr("Enter your email.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Prevent accidental sign-ups (which trigger "confirmation_requested")
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      setEmailAuth(s => ({ ...s, email, step: "enterOtp" }));
    } catch (e) {
      setErr(e.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    const email = (emailAuth.email || "").trim().toLowerCase();
    const token = (emailAuth.otp || "").trim();
    if (!email || !token) return setErr("Enter email and OTP.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw new Error(error.message);

      // Map Supabase-authenticated email -> app user (org_admins / workers / vendors).
      const orgAdmin = await supabase
        .from("org_admins")
        .select("id, username, name, email, organisation_id, organisations(status, access_enabled)")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      const worker = !orgAdmin.data ? await supabase
        .from("workers")
        .select("id, username, name, role, email, organisation_id, organisations(status, access_enabled)")
        .eq("email", email)
        .limit(1)
        .maybeSingle() : { data: null };
      const vendor = (!orgAdmin.data && !worker.data) ? await supabase
        .from("vendors")
        .select("id, username, name, firm_name, email, organisation_id, organisations(status, access_enabled)")
        .eq("email", email)
        .limit(1)
        .maybeSingle() : { data: null };

      const allowedOrg = (org) => org && org.status === "approved" && org.access_enabled !== false;
      if (orgAdmin.data && allowedOrg(orgAdmin.data.organisations)) {
        onLogin({
          id: orgAdmin.data.id,
          username: orgAdmin.data.username,
          role: "admin",
          name: orgAdmin.data.name || orgAdmin.data.username,
          organisationId: orgAdmin.data.organisation_id,
        });
        return;
      }
      if (worker.data && allowedOrg(worker.data.organisations)) {
        onLogin({
          id: worker.data.id,
          username: worker.data.username,
          role: worker.data.role || "worker",
          name: worker.data.name || worker.data.username,
          organisationId: worker.data.organisation_id,
        });
        return;
      }
      if (vendor.data && allowedOrg(vendor.data.organisations)) {
        onLogin({
          id: vendor.data.id,
          username: vendor.data.username,
          role: "vendor",
          name: vendor.data.name || vendor.data.firm_name || vendor.data.username,
          organisationId: vendor.data.organisation_id,
        });
        return;
      }

      await supabase.auth.signOut();
      setErr("This email is not linked to an approved organisation, or the organisation is locked.");
    } catch (e) {
      setErr(e.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const startForgot = () => setForgot({ open: true, email: "", otp: "", step: "enterEmail", newPass: "" });
  const closeForgot = () => setForgot(f => ({ ...f, open: false }));

  const sendForgotOtp = async () => {
    const email = (forgot.email || "").trim().toLowerCase();
    if (!email) return setErr("Enter your email.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      setForgot(f => ({ ...f, email, step: "enterOtp" }));
    } catch (e) {
      setErr(e.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    const email = (forgot.email || "").trim().toLowerCase();
    const token = (forgot.otp || "").trim();
    if (!email || !token) return setErr("Enter email and OTP.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw new Error(error.message);
      setForgot(f => ({ ...f, step: "setPass" }));
    } catch (e) {
      setErr(e.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const setNewPassword = async () => {
    const email = (forgot.email || "").trim().toLowerCase();
    const np = (forgot.newPass || "").trim();
    if (np.length < 4) return setErr("Password must be at least 4 characters.");
    setLoading(true);
    setErr("");
    try {
      // Update password in app tables where email matches (org_admins > workers > vendors).
      const up1 = await supabase.from("org_admins").update({ password: np }).eq("email", email);
      if (up1.error) throw new Error(up1.error.message);
      if ((up1.count || 0) === 0) {
        const up2 = await supabase.from("workers").update({ password: np }).eq("email", email);
        if (up2.error) throw new Error(up2.error.message);
        if ((up2.count || 0) === 0) {
          const up3 = await supabase.from("vendors").update({ password: np }).eq("email", email);
          if (up3.error) throw new Error(up3.error.message);
          if ((up3.count || 0) === 0) throw new Error("No account found for this email.");
        }
      }
      await supabase.auth.signOut();
      closeForgot();
    } catch (e) {
      setErr(e.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" ref={pageRef}>
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />
      <div className="login-side-accent" />
      <div className="login-cursor-ring" style={{ left: mouse.x, top: mouse.y, opacity: cursorVisible ? 0.6 : 0 }} />
      <div
        className="login-credit login-credit-follow"
        style={{ left: mouse.x, top: mouse.y, opacity: cursorVisible ? 1 : 0, visibility: cursorVisible ? "visible" : "hidden" }}
      >
        <div className="login-credit-inner">
          <span className="login-credit-label">Made by</span>
          <span className="login-credit-name">Nihal Chhabra</span>
        </div>
      </div>
      <div className="login-shell">
        <div className="login-card">
        <div className="login-header-wrap" ref={titleRef} style={{ transform: `translate(${titleOffset.x}px, ${titleOffset.y}px)` }}>
          <p className="login-welcome">Welcome to</p>
          {brand.logo ? <img src={brand.logo} alt="logo" className="login-logo-img" />
            : <div className="login-logo-placeholder"><Icon name="printer" size={26} color="#fff" /></div>}
          <h1 className="login-shop-name">{brand.shopName}</h1>
          <p className="login-subtitle">Billing & Business Management System</p>
        </div>
        <div className="card">
          <div className="segmented" style={{ marginBottom: 14 }}>
            <button className={`segmented-btn ${mode === "username" ? "active" : ""}`} onClick={() => { setMode("username"); setErr(""); }}>
              Username
            </button>
            <button className={`segmented-btn ${mode === "email" ? "active" : ""}`} onClick={() => { setMode("email"); setErr(""); }}>
              Email OTP
            </button>
          </div>

          {mode === "username" ? (
            <>
              <div className="form-group mb-4">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  placeholder="admin"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && go()}
                  style={{ fontSize: 16 }}
                />
              </div>
              <div className="form-group mb-2">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && go()}
                  style={{ fontSize: 16 }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={startForgot} type="button">Forgot password?</button>
              </div>
              {err && <div style={{ color: "var(--danger)", fontSize: ".8rem", marginBottom: 12 }}>{err}</div>}
              <div className="login-btn-wrap" style={{ transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)` }} ref={btnRef}>
                <button className="btn btn-primary login-btn-magnetic" style={{ width: "100%", justifyContent: "center" }} onClick={go} disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group mb-4">
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={emailAuth.email}
                  onChange={e => setEmailAuth(s => ({ ...s, email: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && (emailAuth.step === "enterEmail" ? sendEmailOtp() : verifyEmailOtp())}
                  style={{ fontSize: 14, textTransform: "none" }}
                />
              </div>
              {emailAuth.step === "enterOtp" && (
                <div className="form-group mb-4">
                  <label>OTP</label>
                  <input
                    inputMode="numeric"
                    placeholder="Enter OTP"
                    value={emailAuth.otp}
                    onChange={e => setEmailAuth(s => ({ ...s, otp: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && verifyEmailOtp()}
                    style={{ fontSize: 16 }}
                  />
                </div>
              )}
              {err && <div style={{ color: "var(--danger)", fontSize: ".8rem", marginBottom: 12 }}>{err}</div>}
              <div className="login-btn-wrap" style={{ transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)` }} ref={btnRef}>
                {emailAuth.step === "enterEmail" ? (
                  <button className="btn btn-primary login-btn-magnetic" style={{ width: "100%", justifyContent: "center" }} onClick={sendEmailOtp} disabled={loading}>
                    {loading ? "Sending…" : "Send OTP"}
                  </button>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button className="btn btn-ghost" onClick={() => setEmailAuth(s => ({ ...s, step: "enterEmail", otp: "" }))} disabled={loading}>Change Email</button>
                    <button className="btn btn-primary login-btn-magnetic" onClick={verifyEmailOtp} disabled={loading}>
                      {loading ? "Verifying…" : "Verify OTP"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="divider" />
          <div style={{ fontSize: ".72rem", color: "var(--text3)", textAlign: "center", marginTop: 10 }}>
            New organisation? <a href="?register" style={{ color: "var(--accent)", textDecoration: "underline" }}>Register here</a>
          </div>
        </div>
      </div>

        <div className="login-hero" aria-label="Product preview panel">
          <div className="login-hero-top">
            <div className="login-hero-badge">
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
              Live preview • invoices • payments
            </div>
            <div style={{ fontWeight: 900, color: "rgba(226,232,240,.86)", fontSize: 12 }}>Works on mobile + desktop</div>
          </div>
          <div className="login-hero-shot">
            <img src="/hero-billing.svg" alt="Billing software preview" loading="eager" />
          </div>
          <div className="login-hero-points">
            <div className="login-hero-point">
              <b>One‑click share</b>
              <span>Send invoice on WhatsApp & Email automatically.</span>
            </div>
            <div className="login-hero-point">
              <b>Track dues</b>
              <span>Paid/unpaid, partial payments, reminders.</span>
            </div>
            <div className="login-hero-point">
              <b>Customers</b>
              <span>Customer list auto-created from bills.</span>
            </div>
            <div className="login-hero-point">
              <b>Reports</b>
              <span>Revenue, pending dues, daily summary.</span>
            </div>
          </div>
        </div>
      </div>

      {forgot.open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeForgot()}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Reset Password (OTP)</div>
              <button className="btn btn-icon btn-ghost" onClick={closeForgot}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 12 }}>
                We will send an OTP to your email. After verification, you can set a new password for your account.
              </div>
              <div className="form-group mb-4">
                <label>Email</label>
                <input type="email" value={forgot.email} onChange={e => setForgot(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" style={{ textTransform: "none" }} />
              </div>
              {forgot.step !== "enterEmail" && (
                <div className="form-group mb-4">
                  <label>OTP</label>
                  <input inputMode="numeric" value={forgot.otp} onChange={e => setForgot(f => ({ ...f, otp: e.target.value }))} placeholder="Enter OTP" />
                </div>
              )}
              {forgot.step === "setPass" && (
                <div className="form-group mb-2">
                  <label>New Password</label>
                  <input type="password" value={forgot.newPass} onChange={e => setForgot(f => ({ ...f, newPass: e.target.value }))} placeholder="Min 4 characters" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeForgot} disabled={loading}>Cancel</button>
              {forgot.step === "enterEmail" ? (
                <button className="btn btn-primary" onClick={sendForgotOtp} disabled={loading}>{loading ? "Sending…" : "Send OTP"}</button>
              ) : forgot.step === "enterOtp" ? (
                <button className="btn btn-primary" onClick={verifyForgotOtp} disabled={loading}>{loading ? "Verifying…" : "Verify OTP"}</button>
              ) : (
                <button className="btn btn-primary" onClick={setNewPassword} disabled={loading}>{loading ? "Saving…" : "Update Password"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

