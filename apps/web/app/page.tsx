"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./dashboard.module.css";
import { summarizeApplications, summarizePlatforms } from "./lib/dashboard";
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
  const [stage, setStage] = useState<Status | "ALL">("ALL");
  const [sort, setSort] = useState("newest");
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

  const summary = summarizeApplications(applications);
  const platformSummary = summarizePlatforms(applications);
  const visible = applications
    .filter(
      (a) =>
        (category === "ALL" || a.category === category) &&
        (stage === "ALL" || a.status === stage) &&
        (a.position + " " + a.company.name)
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "company"
        ? a.company.name.localeCompare(b.company.name) ||
          a.position.localeCompare(b.position)
        : (sort === "oldest" ? 1 : -1) *
            (Date.parse(a.createdAt) - Date.parse(b.createdAt)) ||
          a.id.localeCompare(b.id),
    );
  const filtered = category !== "ALL" || stage !== "ALL" || !!search;
  function clearFilters() {
    setCategory("ALL");
    setStage("ALL");
    setSearch("");
  }
  return (
    <main className={styles.page}>
      <header className="page-header">
        <div>
          <p className="eyebrow">JOBFLOW / YOUR NEXT CHAPTER</p>
          <h1>Your job search</h1>
          <p>
            A clear view of your opportunities and the progress you’re making.
          </p>
        </div>
        <button onClick={() => setCreating(true)}>+ New application</button>
      </header>
      {creating && (
        <NewApplication
          onClose={() => setCreating(false)}
          onCreated={(application) => {
            setApplications((current) => [application, ...current]);
            setCreating(false);
            clearFilters();
            setSort("newest");
            setNotice(
              application.resumes?.length
                ? "Application and resume saved. Open details to review and download PDF."
                : "Application saved. You can prepare a resume from its details.",
            );
          }}
        />
      )}
      <section aria-labelledby="dashboard-title" className={styles.dashboard}>
        <div className={styles.sectionHeading}>
          <h2 id="dashboard-title">Search overview</h2>
          <span>All applications · current statuses</span>
        </div>
        <div className={styles.metrics}>
          {(
            [
              [
                "Total opportunities",
                summary.total,
                "Every role you are tracking",
                "neutral",
              ],
              [
                "Applications sent",
                summary.submitted,
                "All stages beyond Wishlist",
                "green",
              ],
              [
                "Responses",
                summary.responses,
                "Screening, interviews, offers & rejections",
                "blue",
              ],
              [
                "Rejected",
                summary.rejected,
                "Currently marked as rejected",
                "red",
              ],
            ] as const
          ).map(([label, value, help, tone]) => (
            <article
              key={label}
              aria-label={label}
              className={styles.metric}
              data-tone={tone}
            >
              <h3>{label}</h3>
              <strong>{loading || loadError ? "—" : value}</strong>
              <p>{help}</p>
            </article>
          ))}
        </div>
        <div className={styles.summaryLine}>
          <p>
            {loading || loadError ? (
              "Your summary will appear once applications load."
            ) : (
              <>
                <strong>{summary.waiting}</strong> awaiting a reply{" "}
                <span aria-hidden="true">·</span>{" "}
                <strong>{summary.offers}</strong> offers
              </>
            )}
          </p>
          <details>
            <summary>How these numbers work</summary>
            <p>
              Counts cover all applications, regardless of table filters. Sent
              means any current stage beyond Wishlist, including Withdrawn.
              Responses include Screening, interviews, Offer and Rejected; a
              rejection counts as a response. These are status-based estimates,
              not a history of emails or past responses. Moving a role back to
              Wishlist or Withdrawn can change the counts.
            </p>
          </details>
        </div>
      </section>
      <section className={styles.dashboard} aria-labelledby="platforms-title">
        <div className={styles.sectionHeading}><h2 id="platforms-title">Responses by platform</h2><span>Highest response rate first</span></div>
        <p className="muted">Responses ÷ applications sent. Includes rejections; excludes Wishlist. Based on current stages across all applications. Compare sample sizes alongside percentages.</p>
        {loading || loadError ? <p>Platform metrics will appear once applications load.</p> : !platformSummary.length ? <p>No submitted applications yet. Add a platform when creating or editing an application.</p> : (
          <div className={styles.tableScroll} role="region" aria-label="Platform response metrics" tabIndex={0}>
            <table className={styles.table} aria-label="Responses by platform">
              <thead><tr><th scope="col">Platform</th><th scope="col">Applications sent</th><th scope="col">Responses</th><th scope="col">Response rate</th></tr></thead>
              <tbody>{platformSummary.map((item) => <tr key={item.platform}><th scope="row">{item.platform}</th><td>{item.submitted}</td><td>{item.responses}</td><td>{item.rate.toFixed(1)}%</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className={styles.list} aria-labelledby="applications-title">
        <div className={styles.listHeading}>
          <div>
            <h2 id="applications-title">Applications</h2>
            <p>Keep your next move in view.</p>
          </div>
          <span>
            {loading || loadError
              ? "—"
              : visible.length + " of " + applications.length}{" "}
            roles
          </span>
        </div>
        <div className={styles.filters}>
          <label className={styles.search}>
            Find an application
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by role or company…"
            />
          </label>
          <label>
            Job category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "ALL")}
            >
              <option value="ALL">All roles</option>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter by stage
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Status | "ALL")}
            >
              <option value="ALL">All stages</option>
              {stages.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="company">Company A–Z</option>
            </select>
          </label>
          {filtered && (
            <button className="secondary" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        <p className={styles.feedback} role="status">
          {notice}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className={styles.empty} role="status">
            Loading applications…
          </p>
        ) : loadError ? (
          <div className="error" role="alert">
            <p>{loadError}</p>
            <button onClick={load}>Retry loading</button>
          </div>
        ) : !applications.length ? (
          <div className={styles.empty}>
            <h3>Your next chapter starts here.</h3>
            <p>
              Paste a job offer to add your first application and start tracking
              your progress.
            </p>
            <button onClick={() => setCreating(true)}>
              Add your first application
            </button>
          </div>
        ) : !visible.length ? (
          <div className={styles.empty}>
            <h3>No matching applications</h3>
            <p>
              Try another search or clear your filters to see all your roles.
            </p>
            <button className="secondary" onClick={clearFilters}>
              Show all applications
            </button>
          </div>
        ) : (
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Applications table. Scroll horizontally on smaller screens."
          >
            <table className={styles.table} aria-label="Applications">
              <caption className={styles.srOnly}>
                Applications, their current stages and resume progress
              </caption>
              <thead>
                <tr>
                  <th scope="col">Company & role</th>
                  <th scope="col">Category</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Added</th>
                  <th scope="col">Resume</th>
                  <th scope="col">
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((application) => (
                  <tr key={application.id}>
                    <th scope="row" className={styles.role}>
                      <span className={styles.company}>
                        {application.company.name}
                      </span>
                      <Link href={"/applications/" + application.id}>
                        {application.position}
                      </Link>
                      <span className={styles.location}>
                        {application.location || "Location not specified"}
                      </span>
                    </th>
                    <td>
                      <span className={styles.category}>
                        {categories.find(
                          ([value]) => value === application.category,
                        )?.[1] || "Uncategorized"}
                      </span>
                    </td>
                    <td>{application.platform || "Not specified"}</td>
                    <td>
                      <select
                        className={styles.stage}
                        data-status={application.status}
                        aria-label={
                          "Stage for " +
                          application.position +
                          " at " +
                          application.company.name
                        }
                        value={application.status}
                        disabled={moving.includes(application.id)}
                        onChange={(e) =>
                          void move(application, e.target.value as Status)
                        }
                      >
                        {stages.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {moving.includes(application.id) && (
                        <span role="status" className={styles.location}>
                          Saving…
                        </span>
                      )}
                    </td>
                    <td className={styles.date}>
                      <time dateTime={application.createdAt}>
                        {new Date(application.createdAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </time>
                    </td>
                    <td>
                      <span
                        className={styles.resume}
                        data-ready={!!application.resumes?.[0]?.reviewedAt}
                      >
                        {application.resumes?.[0]?.reviewedAt
                          ? "PDF ready"
                          : application.resumes?.length
                            ? "Resume draft"
                            : "Not started"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          href={"/applications/" + application.id}
                          aria-label={
                            "Open details for " +
                            application.position +
                            " at " +
                            application.company.name
                          }
                        >
                          Open details →
                        </Link>
                        {application.jobUrl && (
                          <a
                            href={application.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={
                              "View job for " +
                              application.position +
                              " at " +
                              application.company.name
                            }
                          >
                            View job ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
