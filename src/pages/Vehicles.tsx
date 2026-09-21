import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CarFront,
  Pencil,
  Plus,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Badge,
  dateTime,
  Empty,
  ErrorBox,
  Heading,
  Modal,
  Skeleton,
  useToast,
} from "../components/ui";
import { db } from "../lib/supabase";
import {
  isValidPlate,
  normalizePlate,
} from "../../supabase/functions/_shared/domain";
import type { Vehicle, VehicleStatus } from "../types";
const initial = {
  plate_number: "",
  owner_name: "",
  vehicle_type: "Car",
  status: "ACTIVE" as VehicleStatus,
};
export function Vehicles() {
  const [rows, setRows] = useState<Vehicle[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0),
    [count, setCount] = useState(0);
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null),
    [form, setForm] = useState(initial),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [deleting, setDeleting] = useState<Vehicle | null>(null),
    [details, setDetails] = useState<Vehicle | null>(null);
  const toast = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let query = db()
        .from("registered_vehicles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .order("vehicle_id");
      const safe = search.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      if (safe)
        query = query.or(
          `plate_number.ilike.%${normalizePlate(safe)}%,owner_name.ilike.%${safe}%`,
        );
      if (status) query = query.eq("status", status);
      const { data, error, count } = await query.range(
        page * 12,
        page * 12 + 11,
      );
      if (error) throw error;
      setRows(data as Vehicle[]);
      setCount(count ?? 0);
    } catch {
      setError("The vehicle registry could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  function edit(vehicle: Vehicle | "new") {
    setEditing(vehicle);
    setForm(
      vehicle === "new"
        ? initial
        : {
            plate_number: vehicle.plate_number,
            owner_name: vehicle.owner_name,
            vehicle_type: vehicle.vehicle_type,
            status: vehicle.status,
          },
    );
    setFormError("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    const plate = normalizePlate(form.plate_number);
    if (!isValidPlate(plate)) {
      setFormError("Enter a valid plate with 5–12 letters and digits.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        plate_number: plate,
        owner_name: form.owner_name.trim(),
      };
      const query =
        editing === "new"
          ? db().from("registered_vehicles").insert(payload)
          : db()
              .from("registered_vehicles")
              .update(payload)
              .eq("vehicle_id", (editing as Vehicle).vehicle_id);
      const { error } = await query.select().single();
      if (error) {
        setFormError(
          error.code === "23505"
            ? "This plate is already registered."
            : "Could not save the vehicle. Check your access and try again.",
        );
        return;
      }
      setEditing(null);
      toast("Vehicle registry updated.");
      void load();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      const { error } = await db()
        .from("registered_vehicles")
        .delete()
        .eq("vehicle_id", deleting.vehicle_id)
        .select()
        .single();
      if (error) throw error;
      setDeleting(null);
      toast("Vehicle deleted. Historical incidents are preserved.");
      if (rows.length === 1 && page > 0) setPage(page - 1);
      else void load();
    } catch {
      toast("Vehicle could not be deleted.", true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="KNOW YOUR REGISTERED VEHICLES"
        title="Vehicle registry"
        description="Manage authorized vehicles, owners, and access status."
        action={
          <button className="button" onClick={() => edit("new")}>
            <Plus size={18} /> Register vehicle
          </button>
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search vehicles"
              placeholder="Search plate or owner…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Filter vehicle status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {["ACTIVE", "BLOCKED", "EXPIRED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="mono muted">{count} VEHICLES</span>
        </div>
        {error && <ErrorBox message={error} retry={load} />}{" "}
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <Empty title="No vehicles found">
            Register a vehicle or adjust your filters.
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>VEHICLE / PLATE</th>
                  <th>OWNER</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>REGISTERED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.vehicle_id}>
                    <td>
                      <button
                        className="plate-link"
                        onClick={() => setDetails(v)}
                      >
                        <CarFront size={18} />
                        {v.plate_number}
                      </button>
                    </td>
                    <td>{v.owner_name}</td>
                    <td>{v.vehicle_type}</td>
                    <td>
                      <Badge tone={v.status}>{v.status}</Badge>
                    </td>
                    <td className="muted">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${v.plate_number}`}
                          onClick={() => edit(v)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Delete ${v.plate_number}`}
                          onClick={() => setDeleting(v)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            Page {page + 1} of {Math.max(1, Math.ceil(count / 12))}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={(page + 1) * 12 >= count}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {editing && (
        <Modal
          title={editing === "new" ? "Register vehicle" : "Edit vehicle"}
          onClose={() => {
            if (!saving) setEditing(null);
          }}
        >
          <form className="vehicle-form" onSubmit={save}>
            <label>
              Plate number
              <input
                required
                maxLength={40}
                value={form.plate_number}
                onChange={(e) =>
                  setForm({ ...form, plate_number: e.target.value })
                }
                placeholder="MH12AB1234"
              />
            </label>
            <label>
              Owner name
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.owner_name}
                onChange={(e) =>
                  setForm({ ...form, owner_name: e.target.value })
                }
              />
            </label>
            <div className="form-row">
              <label>
                Vehicle type
                <select
                  value={form.vehicle_type}
                  onChange={(e) =>
                    setForm({ ...form, vehicle_type: e.target.value })
                  }
                >
                  {["Car", "Motorcycle", "Truck", "Bus", "Other"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as VehicleStatus,
                    })
                  }
                >
                  {["ACTIVE", "BLOCKED", "EXPIRED"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            {formError && <ErrorBox message={formError} />}
            <button className="button full" disabled={saving}>
              {saving ? "Saving…" : "Save vehicle"}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete registration?"
          onClose={() => {
            if (!saving) setDeleting(null);
          }}
        >
          <p>
            Remove <strong>{deleting.plate_number}</strong> from the registry?
            Historical incidents will remain available.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="button destructive"
              disabled={saving}
              onClick={remove}
            >
              {saving ? "Deleting…" : "Delete vehicle"}
            </button>
          </div>
        </Modal>
      )}
      {details && (
        <Modal title="Vehicle details" onClose={() => setDetails(null)}>
          <div className="vehicle-details">
            <CarFront size={40} />
            <h2 className="plate-text">{details.plate_number}</h2>
            <Badge tone={details.status}>{details.status}</Badge>
            <p>
              {details.owner_name} · {details.vehicle_type}
            </p>
            <p className="muted">Registered {dateTime(details.created_at)}</p>
            <button
              className="button secondary"
              onClick={() => {
                setDetails(null);
                edit(details);
              }}
            >
              <Pencil size={16} />
              Edit registration
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
