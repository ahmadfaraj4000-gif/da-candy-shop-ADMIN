import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { useAuth } from "./hooks/useAuth.js";

export default function App({ missingConvexUrl = false }) {
  const auth = useAuth();

  return (
    <ToastProvider>
      {missingConvexUrl && (
        <div className="env-warning">
          Add <code>VITE_CONVEX_URL</code> to <code>admin/.env.local</code> to connect the admin dashboard.
        </div>
      )}
      <Routes>
        <Route path="/" element={auth.isAuthed ? <Navigate to="/dashboard" /> : <Login onLogin={auth.login} />} />
        <Route
          path="/dashboard"
          element={auth.isAuthed ? (missingConvexUrl ? <ConvexSetup onLogout={auth.logout} /> : <Dashboard onLogout={auth.logout} />) : <Navigate to="/" />}
        />
      </Routes>
    </ToastProvider>
  );
}

function ConvexSetup({ onLogout }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Convex URL Required</h1>
        <p className="muted">Create <code>admin/.env.local</code> and add <code>VITE_CONVEX_URL=https://your-deployment.convex.cloud</code>, then restart Vite.</p>
        <button className="primary-button" onClick={onLogout}>Back to Login</button>
      </section>
    </main>
  );
}
