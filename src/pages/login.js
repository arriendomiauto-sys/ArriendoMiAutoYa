import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, usuario, errorAcceso } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (usuario) router.replace("/");
  }, [usuario, router]);

  if (usuario) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="logo"><KeyRound size={22} /></div>
        <h1>Consola RentACar</h1>
        <p className="lead">Ingreso del equipo de operaciones.</p>

        <div className="field">
          <label>Correo</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        {(error || errorAcceso) ? (
          <div className="state-msg err" style={{ marginBottom: 12 }}>{error || errorAcceso}</div>
        ) : null}

        <button type="submit" className="btn btn-mint" disabled={cargando}>
          {cargando ? "Ingresando…" : "Entrar"}
        </button>

        <div className="login-note">
          El panel habla solo con la API de RentACar. El acceso está limitado a cuentas con rol <b>admin</b>, <b>manager</b> o <b>soporte</b>.
        </div>
      </form>
    </div>
  );
}
