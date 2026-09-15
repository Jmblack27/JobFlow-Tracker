"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

const stages = [
  ["WISHLIST", "Wishlist"],
  ["APPLIED", "Applied"],
  ["SCREENING", "Screening"],
  ["TECHNICAL_INTERVIEW", "Technical interview"],
  ["FINAL_INTERVIEW", "Final interview"],
  ["OFFER", "Offer"],
  ["REJECTED", "Rejected"],
  ["WITHDRAWN", "Withdrawn"],
] as const;
type Status = (typeof stages)[number][0];
type Application = {
  id: string;
  position: string;
  company: { name: string };
  location: string | null;
  jobUrl: string | null;
  status: Status;
};

async function api<T>(path = "", options?: RequestInit): Promise<T> {
  const response = await fetch("/api/applications" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Could not reach JobFlow. Please try again.",
    );
  }
  return response.json() as Promise<T>;
}

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      setApplications(await api<Application[]>());
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load applications.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    api<Application[]>("", { signal: controller.signal })
      .then(setApplications)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const application = await api<Application>("", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(fields)),
      });
      setApplications((current) => [application, ...current]);
      form.reset();
      setNotice("Application added.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create application.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function move(application: Application, status: Status) {
    setMoving((current) => [...current, application.id]);
    setError("");
    setNotice("");
    try {
      const updated = await api<Application>("/" + application.id, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(
        application.position +
          " moved to " +
          stages.find(([value]) => value === status)?.[1] +
          ".",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to move application.",
      );
    } finally {
      setMoving((current) => current.filter((id) => id !== application.id));
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">JOBFLOW / YOUR NEXT CHAPTER</p>
          <h1>Applications</h1>
          <p>
            Keep every opportunity moving, from your first bookmark to your next
            offer.
          </p>
        </div>
        <span className="total">{applications.length} opportunities</span>
      </header>
      <section className="create-panel" aria-labelledby="create-title">
        <div>
          <h2 id="create-title">Add an opportunity</h2>
          <p>
            Start with a company and a role. Make the next move when you’re
            ready.
          </p>
        </div>
        <form onSubmit={create}>
          <fieldset disabled={saving || loading || !!loadError}>
            <label>
              Company{" "}
              <input
                name="companyName"
                required
                maxLength={200}
                placeholder="Acme"
              />
            </label>
            <label>
              Position{" "}
              <input
                name="position"
                required
                maxLength={200}
                placeholder="Product engineer"
              />
            </label>
            <label>
              Location{" "}
              <input name="location" maxLength={200} placeholder="Remote" />
            </label>
            <label>
              Job link{" "}
              <input
                name="jobUrl"
                type="url"
                maxLength={2048}
                placeholder="https://"
              />
            </label>
            <label>
              Stage{" "}
              <select name="status" defaultValue="WISHLIST">
                {stages.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">
              {saving ? "Adding…" : "+ Add application"}
            </button>
          </fieldset>
        </form>
      </section>
      <div className="feedback" aria-live="polite">
        {notice}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading applications…</p>
      ) : loadError ? (
        <div className="error" role="alert">
          <p>{loadError}</p>
          <button onClick={load}>Retry loading</button>
        </div>
      ) : (
        <>
          {applications.length === 0 && (
            <p className="empty-board">
              Your next chapter starts here. Add your first application above.
            </p>
          )}
          <div className="board" aria-label="Applications by stage">
            {stages.map(([status, label]) => {
              const items = applications.filter(
                (item) => item.status === status,
              );
              return (
                <section
                  className={"column stage-" + status.toLowerCase()}
                  key={status}
                  aria-label={label}
                >
                  <h2>
                    <span className="dot" />
                    {label}
                    <span className="count">{items.length}</span>
                  </h2>
                  {items.length === 0 && (
                    <p className="empty-column">No applications yet</p>
                  )}
                  {items.map((application) => (
                    <article className="card" key={application.id}>
                      <p className="company">{application.company.name}</p>
                      <h3>{application.position}</h3>
                      {application.location && (
                        <p className="location">{application.location}</p>
                      )}
                      {application.jobUrl && (
                        <a
                          href={application.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View job ↗
                        </a>
                      )}
                      <label className="move-label">
                        Move to
                        <select
                          aria-label={
                            "Stage for " +
                            application.position +
                            " at " +
                            application.company.name
                          }
                          value={application.status}
                          disabled={moving.includes(application.id)}
                          onChange={(event) =>
                            void move(application, event.target.value as Status)
                          }
                        >
                          {stages.map(([value, name]) => (
                            <option key={value} value={value}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {moving.includes(application.id) && (
                        <p role="status">Moving…</p>
                      )}
                      <Link
                        className="resume-link"
                        href={"/applications/" + application.id}
                      >
                        Prepare resume →
                      </Link>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
