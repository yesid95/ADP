import { useState } from "react";
import { FormStatus } from "./shared.jsx";
import { errorMessage } from "./utils.js";

export function AuthPanel({ client, onAuthenticated, initialNotice }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice || "");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState({
    displayName: "",
    email: "",
    phone: "",
    password: "",
    role: "FARMER",
    buyerType: "DISTRIBUTOR"
  });
  const [resetEmail, setResetEmail] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await client.login(login);
      await onAuthenticated();
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const trimmedPhone = registration.phone.trim();
      const normalizedPhone = /^\d{10}$/.test(trimmedPhone)
        ? `+57${trimmedPhone}`
        : trimmedPhone;
      const response = await client.request("/auth/register", {
        method: "POST",
        body: {
          displayName: registration.displayName,
          email: registration.email,
          ...(normalizedPhone ? { phone: normalizedPhone } : {}),
          password: registration.password,
          roles: [registration.role],
          ...(registration.role === "BUYER" ? { buyerType: registration.buyerType } : {})
        }
      });
      if (response.verificationToken) {
        await client.request("/auth/verify-email", {
          method: "POST",
          body: { token: response.verificationToken }
        });
        await client.login({ email: registration.email, password: registration.password });
        await onAuthenticated();
        return;
      }
      setNotice("Cuenta creada. Revisa tu correo para activarla antes de iniciar sesión.");
      setLogin({ email: registration.email, password: "" });
      setMode("login");
    } catch (registrationError) {
      setError(errorMessage(registrationError));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetRequest(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await client.request("/auth/request-password-reset", {
        method: "POST",
        body: { email: resetEmail }
      });
      setNotice("Si el correo está registrado, recibirás instrucciones para restablecer la clave.");
      setMode("login");
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="platform-auth">
      <section className="platform-auth-copy">
        <p className="eyebrow">ADP · Fase 2 persistente</p>
        <h1>Negociaciones agrícolas respaldadas por datos reales.</h1>
        <p>
          Registra una finca, publica una cosecha o presenta una oferta. La API conserva el
          historial, protege los contactos y adjudica un único ganador.
        </p>
      </section>
      <section className="panel platform-auth-card">
        <div className="platform-mode-tabs" role="tablist" aria-label="Acceso">
          <button aria-selected={mode !== "register"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} role="tab" type="button">
            Ingresar
          </button>
          <button aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} role="tab" type="button">
            Crear cuenta
          </button>
        </div>
        <FormStatus error={error} notice={notice} />
        {mode === "login" && (
          <form className="platform-form" onSubmit={submitLogin}>
            <h2>Tu cuenta</h2>
            <label className="form-field">
              Correo
              <input required type="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} />
            </label>
            <label className="form-field">
              Contraseña
              <input required minLength={12} type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
            <button className="text-action" onClick={() => setMode("reset")} type="button">
              Olvidé mi contraseña
            </button>
          </form>
        )}
        {mode === "register" && (
          <form className="platform-form" onSubmit={submitRegistration}>
            <h2>Crear cuenta real</h2>
            <label className="form-field">
              Nombre visible
              <input required minLength={2} value={registration.displayName} onChange={(event) => setRegistration({ ...registration, displayName: event.target.value })} />
            </label>
            <label className="form-field">
              Correo
              <input required type="email" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} />
            </label>
            <label className="form-field">
              Teléfono (opcional)
              <input placeholder="3123902469 o +573123902469" value={registration.phone} onChange={(event) => setRegistration({ ...registration, phone: event.target.value })} />
            </label>
            <label className="form-field">
              Contraseña (mínimo 12 caracteres)
              <input required minLength={12} type="password" value={registration.password} onChange={(event) => setRegistration({ ...registration, password: event.target.value })} />
            </label>
            <label className="form-field">
              Tipo de cuenta
              <select value={registration.role} onChange={(event) => setRegistration({ ...registration, role: event.target.value })}>
                <option value="FARMER">Productor / finquero</option>
                <option value="BUYER">Comprador</option>
              </select>
            </label>
            {registration.role === "BUYER" && (
              <label className="form-field">
                Tipo de comprador
                <select value={registration.buyerType} onChange={(event) => setRegistration({ ...registration, buyerType: event.target.value })}>
                  <option value="WHOLESALER">Mayorista</option>
                  <option value="DISTRIBUTOR">Distribuidor</option>
                  <option value="STORE">Tienda</option>
                  <option value="RESTAURANT">Restaurante</option>
                  <option value="TRANSPORTER">Transportador</option>
                </select>
              </label>
            )}
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "Creando…" : "Crear y verificar cuenta"}
            </button>
          </form>
        )}
        {mode === "reset" && (
          <form className="platform-form" onSubmit={submitResetRequest}>
            <h2>Recuperar contraseña</h2>
            <p className="helper-copy">La respuesta no revela si el correo existe.</p>
            <label className="form-field">
              Correo
              <input required type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
            </label>
            <button className="primary-button" disabled={busy} type="submit">Enviar instrucciones</button>
            <button className="text-action" onClick={() => setMode("login")} type="button">Volver al ingreso</button>
          </form>
        )}
      </section>
    </main>
  );
}
