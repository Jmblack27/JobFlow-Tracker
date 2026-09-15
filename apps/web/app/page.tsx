"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import NewApplication from "./new-application";
import { stages, categories } from "./lib/applications";
import type { Application, Status, Category } from "./lib/applications";

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
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [search, setSearch] = useState("");
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
        <div className="action-row">
          <span className="total">{applications.length} opportunities</span>
          <button onClick={() => setCreating(true)}>+ New application</button>
        </div>
      </header>
      {creating && (
        <NewApplication
          onClose={() => setCreating(false)}
          onCreated={(application) => {
            setApplications((current) => [application, ...current]);
            setCreating(false);
            setCategory("ALL");
            setSearch("");
            setNotice(
              application.resumes?.length
                ? "Application and resume saved. Open details to review and download PDF."
                : "Application saved. You can prepare a resume from its details.",
            );
          }}
        />
      )}
      <section className="board-toolbar" aria-label="Board tools">
        <label>
          Find an application
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role or company…"
          />
        </label>
        <p>Start with an offer. Track each step. Prepare your next move.</p>
      </section>
      <nav className="category-filters" aria-label="Job categories">
        {([["ALL", "All roles"], ...categories] as const).map(
          ([value, label]) => (
            <button
              className="secondary"
              key={value}
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {label}{" "}
              <span>
                {
                  applications.filter(
                    (a) => value === "ALL" || a.category === value,
                  ).length
                }
              </span>
            </button>
          ),
        )}
      </nav>
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
              Your next chapter starts here. Select New application to paste
              your first offer.
            </p>
          )}
          <div className="board" aria-label="Applications by stage">
            {stages.map(([status, label]) => {
              const items = applications.filter(
                (item) =>
                  item.status === status &&
                  (category === "ALL" || item.category === category) &&
                  (item.position + " " + item.company.name)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
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
                      <p className="card-category">
                        {categories.find(
                          ([value]) => value === application.category,
                        )?.[1] || "Uncategorized"}
                      </p>
                      <p className="company">{application.company.name}</p>
                      <h3>
                        <Link href={"/applications/" + application.id}>
                          {application.position}
                        </Link>
                      </h3>
                      <p className="card-meta">
                        Added{" "}
                        {new Date(application.createdAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </p>
                      <span className="status-pill">
                        {application.resumes?.[0]?.reviewedAt
                          ? "PDF ready"
                          : application.resumes?.length
                            ? "Resume draft"
                            : "Resume not started"}
                      </span>
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
                        Open details →
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
