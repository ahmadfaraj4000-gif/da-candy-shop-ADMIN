import { LockKeyhole } from "lucide-react";
import { useState } from "react";

export default function Login({ onLogin }) {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = await onLogin(data.email, data.password);
    setError(result.ok ? "" : result.message);
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark"><LockKeyhole /></div>
        <h1>Da Candy Shop Admin</h1>
        <label>Email <input name="email" type="email" required autoComplete="username" /></label>
        <label>Password <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" /></label>
        <label className="checkbox-row show-password"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /> Show password</label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">Login</button>
      </form>
    </main>
  );
}
