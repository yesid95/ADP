import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiClient } from "../lib/api.js";
import { AuthPanel } from "./platform/AuthPanel.jsx";
import { BuyerWorkspace } from "./platform/BuyerWorkspace.jsx";
import { FarmerWorkspace } from "./platform/FarmerWorkspace.jsx";
import { errorMessage } from "./platform/utils.js";
import "../platform.css";

export function PlatformApp({ client = apiClient, onOpenDemo }) {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState(null);
  const [catalog, setCatalog] = useState({ departments: [], crops: [] });
  const [publicListings, setPublicListings] = useState([]);
  const [activeRole, setActiveRole] = useState(null);
  const [initialNotice, setInitialNotice] = useState("");
  const [fatalError, setFatalError] = useState("");

  const loadPublicListings = useCallback(async () => {
    const page = await client.request("/listings?limit=100");
    setPublicListings(page.data);
  }, [client]);

  const loadProfile = useCallback(async () => {
    const response = await client.request("/me");
    setProfile(response.data);
    setActiveRole((current) => current || (response.data.roles.includes("FARMER") ? "FARMER" : "BUYER"));
    if (response.data.roles.includes("BUYER")) await loadPublicListings();
  }, [client, loadPublicListings]);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const [catalogResponse] = await Promise.all([
          client.request("/catalogs"),
          loadPublicListings()
        ]);
        if (!active) return;
        setCatalog(catalogResponse.data);
        const token = new URLSearchParams(window.location.search).get("token");
        if (token && window.location.pathname.includes("verificar-correo")) {
          await client.request("/auth/verify-email", { method: "POST", body: { token } });
          setInitialNotice("Correo verificado. Ya puedes iniciar sesión.");
          window.history.replaceState({}, "", "/");
        }
        if (client.hasStoredSession()) {
          await client.bootstrap();
          await loadProfile();
        }
      } catch (error) {
        client.clearSession();
        if (error instanceof ApiError && error.status === 401) {
          setInitialNotice("La sesión anterior venció. Ingresa de nuevo.");
        } else {
          setFatalError(errorMessage(error));
        }
      } finally {
        if (active) setBooting(false);
      }
    }
    boot();
    return () => { active = false; };
  }, [client, loadProfile, loadPublicListings]);

  const availableRoles = useMemo(() => profile?.roles.filter((role) => role === "FARMER" || role === "BUYER") || [], [profile]);

  async function logout() {
    await client.logout();
    setProfile(null);
    setActiveRole(null);
  }

  if (booting) return <div className="platform-loading" role="status">Conectando con ADP…</div>;
  if (!profile) {
    return (
      <>
        {fatalError && <p className="platform-global-error">{fatalError}</p>}
        <AuthPanel client={client} initialNotice={initialNotice} onAuthenticated={loadProfile} />
        <button className="platform-demo-link" onClick={onOpenDemo} type="button">Ver demo simulada de Fase 1</button>
      </>
    );
  }

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <div><p className="eyebrow">ADP · Datos persistentes</p><h1>Hola, {profile.displayName}</h1><p>{profile.contact.email}</p></div>
        <div className="platform-header-actions">
          {availableRoles.length > 1 && <select aria-label="Rol activo" value={activeRole || ""} onChange={(event) => setActiveRole(event.target.value)}>{availableRoles.map((role) => <option key={role} value={role}>{role === "FARMER" ? "Productor" : "Comprador"}</option>)}</select>}
          <button className="secondary-button" onClick={onOpenDemo} type="button">Demo Fase 1</button>
          <button className="secondary-button" onClick={logout} type="button">Cerrar sesión</button>
        </div>
      </header>
      <main className="platform-main">
        {activeRole === "FARMER" && <FarmerWorkspace catalog={catalog} client={client} />}
        {activeRole === "BUYER" && <BuyerWorkspace client={client} publicListings={publicListings} reloadPublicListings={loadPublicListings} />}
      </main>
    </div>
  );
}
