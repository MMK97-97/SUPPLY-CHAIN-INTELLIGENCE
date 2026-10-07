(() => {
  "use strict";

  if (window.StarkAuth) return;

  const config = window.STARK_SUPABASE_CONFIG;
  const root = document.documentElement;
  const publicPage = root.dataset.authPublic === "true";
  const page = location.pathname.split("/").filter(Boolean).pop() || "index.html";
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const state = { ready: false, session: null, user: null, organizationId: "", organizationName: "", role: "" };
  const esc = value => String(value == null ? "" : value).replace(/[&<>\"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[character]));

  const authRootURL = new URL("../", document.currentScript.src);
  const appRoot = () => authRootURL.pathname;

  const safeReturnTarget = fallback => {
    const entered = new URLSearchParams(location.search).get("return") || fallback || "index.html";
    try {
      const target = new URL(entered, location.href);
      if (target.origin !== location.origin || !target.pathname.startsWith(appRoot())) return "index.html";
      return `${target.pathname.slice(appRoot().length) || "index.html"}${target.search}${target.hash}`;
    } catch (_) {
      return "index.html";
    }
  };

  const currentReturnTarget = () => `${location.pathname.slice(appRoot().length)}${location.search}${location.hash}`;
  const loginUrl = () => new URL(`login.html?return=${encodeURIComponent(currentReturnTarget())}`,authRootURL).href;
  const callbackUrl = type => `${location.origin}${appRoot()}auth-callback.html?flow=${encodeURIComponent(type || "account")}`;
  const reveal = () => {
    root.classList.remove("stark-auth-pending", "stark-auth-failed");
    document.querySelector(".stark-auth-fatal")?.remove();
    root.dataset.authReady = "true";
  };

  const setMessage = (message, error = false) => {
    const node = document.getElementById("auth-message");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(error));
    node.hidden = !message;
  };

  const wirePasswordToggles = scope => {
    scope?.querySelectorAll?.("[data-password-toggle]").forEach(button => {
      if (button.dataset.passwordToggleReady === "true") return;
      const input = button.closest(".auth-input-wrap")?.querySelector("input");
      if (!input) return;
      button.dataset.passwordToggleReady = "true";
      button.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        button.setAttribute("aria-pressed", String(show));
        input.focus({ preventScroll: true });
      });
    });
  };

  async function loadMembership() {
    const { data, error } = await client
      .from("organization_members")
      .select("organization_id, role")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function ensureWorkspace() {
    let membership = await loadMembership();
    if (!membership) {
      const { error } = await client.rpc("bootstrap_organization", {
        organization_name: config.organizationName,
        organization_slug: config.organizationSlug
      });
      if (error) {
        if (error.code === "23505") throw new Error("This account is authenticated but has not been assigned to the Stark organization. Ask an organization owner to add it.");
        throw error;
      }
      membership = await loadMembership();
    }
    if (!membership) throw new Error("No authorized organization membership was found.");

    const { data: organization, error } = await client
      .from("organizations")
      .select("id, name, slug")
      .eq("id", membership.organization_id)
      .single();
    if (error) throw error;
    state.organizationId = membership.organization_id;
    state.organizationName = organization?.name || config.organizationName;
    state.role = membership.role;
    try {
      localStorage.setItem("stark-organization-id", state.organizationId);
      localStorage.setItem("stark-organization-role", state.role);
    } catch (_) {}
    return membership;
  }

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    state.session = data.session || null;
    state.user = data.session?.user || null;
    return state.session;
  }

  function announceReady() {
    state.ready = true;
    reveal();
    window.dispatchEvent(new CustomEvent("stark:auth-ready", { detail: { ...state } }));
  }

  function showAccessError(message) {
    reveal();
    document.body.innerHTML = `<main class="auth-access-denied"><section><img src="assets/supply-chain-logo.png" alt=""><p class="eyebrow">Secure workspace</p><h1>Access assignment required</h1><p>${esc(message)}</p><button id="auth-access-signout" type="button">Sign out</button></section></main>`;
    document.getElementById("auth-access-signout")?.addEventListener("click", () => api.signOut());
  }

  async function signOut() {
    await client.auth.signOut();
    try {
      localStorage.removeItem("stark-organization-id");
      localStorage.removeItem("stark-organization-role");
    } catch (_) {}
    location.replace("login.html");
  }

  async function initLoginPage() {
    reveal();
    const form = document.getElementById("login-form");
    const forgot = document.getElementById("forgot-password");
    wirePasswordToggles(document);
    if (state.session) {
      location.replace(safeReturnTarget("index.html"));
      return;
    }
    setMessage("");
    const submit = form?.querySelector("button[type=submit]");
    if (submit) submit.disabled = false;
    if (forgot) forgot.disabled = false;
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector("button[type=submit]");
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      setMessage("Signing in securely…");
      submit.disabled = true;
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.session = data.session;
        state.user = data.user;
        await ensureWorkspace();
        location.replace(safeReturnTarget("index.html"));
      } catch (error) {
        setMessage(error.message || "Sign in failed.", true);
        submit.disabled = false;
      }
    });
    forgot?.addEventListener("click", async () => {
      const email = form?.elements.email.value.trim();
      if (!email) {
        setMessage("Enter your email address first.", true);
        form?.elements.email.focus();
        return;
      }
      forgot.disabled = true;
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl("recovery") });
        if (error) throw error;
        setMessage("Password reset instructions were sent to your email.");
      } catch (error) {
        setMessage(error.message || "Password reset could not be started.", true);
      } finally {
        forgot.disabled = false;
      }
    });
  }

  async function initCallbackPage() {
    reveal();
    const form = document.getElementById("password-form");
    const description = document.getElementById("callback-description");
    if (!state.session) {
      setMessage("This secure link is invalid or has expired. Request a new invitation or password reset.", true);
      if (form) form.hidden = true;
      return;
    }
    if (description) description.textContent = "Your secure link is verified. Create a password to finish activating the workspace.";
    setMessage("");
    const submit = form?.querySelector("button[type=submit]");
    if (submit) submit.disabled = false;
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const password = form.elements.password.value;
      const confirm = form.elements.confirmPassword.value;
      const submit = form.querySelector("button[type=submit]");
      if (password.length < 12) return setMessage("Use at least 12 characters.", true);
      if (password !== confirm) return setMessage("The passwords do not match.", true);
      submit.disabled = true;
      setMessage("Securing your account…");
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await ensureWorkspace();
        setMessage("Account secured. Opening the workspace…");
        window.setTimeout(() => location.replace("index.html"), 500);
      } catch (error) {
        setMessage(error.message || "The password could not be saved.", true);
        submit.disabled = false;
      }
    });
  }

  async function initialize() {
    try {
      const authFlow = /(?:^|[&#?])type=(?:invite|recovery|signup|magiclink)(?:&|$)/i.test(`${location.search}&${location.hash}`);
      const authorizationCode = new URLSearchParams(location.search).get("code");
      if (!publicPage && (authFlow || authorizationCode) && page !== "auth-callback.html") {
        location.replace(`auth-callback.html${location.search}${location.hash}`);
        return;
      }
      await refreshSession();
      if (!state.session && page === "auth-callback.html" && authorizationCode) {
        const { error } = await client.auth.exchangeCodeForSession(authorizationCode);
        if (error) throw error;
        await refreshSession();
        const cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete("code");
        history.replaceState({}, "", `${cleanUrl.pathname.split("/").pop() || "auth-callback.html"}${cleanUrl.search}${cleanUrl.hash}`);
      }
      window.dispatchEvent(new CustomEvent("stark:auth-client-ready", { detail: { session: state.session } }));
      if (page === "login.html") return initLoginPage();
      if (page === "auth-callback.html") return initCallbackPage();
      if (!state.session) {
        location.replace(loginUrl());
        return;
      }
      try {
        await ensureWorkspace();
      } catch (error) {
        showAccessError(error.message);
        return;
      }
      announceReady();
    } catch (error) {
      if (publicPage) {
        reveal();
        setMessage(error.message || "Authentication failed to initialize.", true);
      } else {
        showAccessError(error.message || "Authentication failed to initialize.");
      }
    }
  }

  const api = {
    client,
    state,
    signOut,
    ensureWorkspace,
    getOrganizationId: () => state.organizationId,
    getAccessToken: () => state.session?.access_token || ""
  };
  window.StarkAuth = api;
  client.auth.onAuthStateChange((event, session) => {
    state.session = session || null;
    state.user = session?.user || null;
    if (event === "SIGNED_OUT" && !publicPage) location.replace("login.html");
  });
  initialize();
})();
