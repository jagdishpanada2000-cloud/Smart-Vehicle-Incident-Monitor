import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Skeleton } from "./components/ui";
import { Shell } from "./layouts/Shell";
import { Landing, Architecture, Login } from "./pages/Public";
import { Dashboard, Analytics } from "./pages/Dashboard";
import { Scanner } from "./pages/Scanner";
import { Vehicles } from "./pages/Vehicles";
import { Incidents } from "./pages/Incidents";
import { System } from "./pages/System";
import { useEffect, useState } from "react";
import { db } from "./lib/supabase";
import { ErrorBox } from "./components/ui";
function OperatorGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null),
    [error, setError] = useState("");
  async function verify() {
    setError("");
    const { data, error } = await db().rpc("sentinel_is_operator");
    if (error)
      setError(
        "Operator access could not be verified. Ensure the database SQL has been applied.",
      );
    else setAllowed(data === true);
  }
  useEffect(() => {
    void verify();
  }, []);
  if (error || allowed === false)
    return (
      <main className="public-wrap" style={{ paddingTop: 60 }}>
        <h1>Operator access required</h1>
        <ErrorBox
          message={
            error ||
            "Your account is signed in but has not been added to the operators table."
          }
          retry={verify}
        />
        <button
          className="button secondary"
          onClick={() => void db().auth.signOut()}
        >
          Sign out
        </button>
      </main>
    );
  return allowed ? <Shell /> : <Skeleton />;
}
function Protected() {
  const { session, loading } = useAuth();
  return loading ? (
    <main className="public-wrap">
      <Skeleton />
    </main>
  ) : session ? (
    <OperatorGate />
  ) : (
    <Navigate to="/login" replace />
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/architecture" element={<Architecture />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/system" element={<System />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
