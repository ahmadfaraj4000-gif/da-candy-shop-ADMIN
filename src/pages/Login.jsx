import { LockKeyhole } from "lucide-react";
import { useState } from "react";

export default function Login({ onLogin }) {
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = onLogin(data.email, data.password);
    setError(result.ok ? "" : result.message);
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark"><LockKeyhole /></div>
        <h1>Da Candy Shop Admin</h1>
        <label>Email <input name="email" type="email" required placeholder="manager@dacandyshop.com" /></label>
        <label>Password <input name="password" type="password" required minLength="6" placeholder="••••••••" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">Login</button>
      </form>
    </main>
  );
}
