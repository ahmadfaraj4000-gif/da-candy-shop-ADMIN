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
        <div className="login-brand">
          <img className="login-logo" src={`${import.meta.env.BASE_URL}da-candy-shop-logo.webp`} alt="Da Candy Shop" />
          <p className="login-portal-title">Admin Portal</p>
        </div>
        <div className="login-heading">
          <h1>Welcome back</h1>
          <p className="muted">Sign in to manage orders, inventory, and payments.</p>
        </div>
        <label>Email <input name="email" type="email" required autoComplete="username" /></label>
        <label>Password <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" /></label>
        <label className="checkbox-row show-password"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /> Show password</label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">Sign In</button>
      </form>
    </main>
  );
}
