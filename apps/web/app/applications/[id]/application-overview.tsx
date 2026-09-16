"use client";
import { useState } from "react";
import PlatformField from "../../platform-field";
import type { FormEvent } from "react";
import { request, errorMessage } from "../../lib/career";
import { stages, categories } from "../../lib/applications";
import type { Application, Status, Category } from "../../lib/applications";
export default function ApplicationOverview({
  application,
  onSaved,
}: {
  application: Application;
  onSaved: (application: Application) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    companyName: application.company.name,
    position: application.position,
    location: application.location || "",
    jobUrl: application.jobUrl || "",
    platform: application.platform || "",
    status: application.status,
    category: application.category,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(
        await request<Application>("/applications/" + application.id, {
          method: "PATCH",
          body: JSON.stringify(draft),
        }),
      );
      setEditing(false);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="career-panel" aria-label="Application overview">
      <div className="section-header">
        <h2>Application overview</h2>
        {!editing && (
          <button className="secondary" onClick={() => setEditing(true)}>
            Edit details
          </button>
        )}
      </div>
      {editing ? (
        <form className="profile-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="profile-grid">
              {(
                [
                  ["companyName", "Company"],
                  ["position", "Position"],
                  ["location", "Location"],
                  ["jobUrl", "Job link"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required={key === "companyName" || key === "position"}
                    type={key === "jobUrl" ? "url" : "text"}
                    maxLength={key === "jobUrl" ? 2048 : 200}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <PlatformField value={draft.platform} onChange={(platform) => setDraft({ ...draft, platform })} />
              <label>
                Job category
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as Category })
                  }
                >
                  {categories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stage
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as Status })
                  }
                >
                  {stages.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="action-row" style={{ marginTop: 20 }}>
              <button type="submit">{busy ? "Saving…" : "Save details"}</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setDraft({
                    companyName: application.company.name,
                    position: application.position,
                    location: application.location || "",
                    jobUrl: application.jobUrl || "",
    platform: application.platform || "",
                    status: application.status,
                    category: application.category,
                  });
                }}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <dl className="profile-grid">
          <div><dt className="muted">Application platform</dt><dd>{application.platform || "Not specified"}</dd></div>
          <div>
            <dt className="muted">Job category</dt>
            <dd>
              {categories.find(
                ([value]) => value === application.category,
              )?.[1] || "Uncategorized"}
            </dd>
          </div>
          <div>
            <dt className="muted">Company</dt>
            <dd>{application.company.name}</dd>
          </div>
          <div>
            <dt className="muted">Stage</dt>
            <dd>
              {stages.find(([value]) => value === application.status)?.[1]}
            </dd>
          </div>
          <div>
            <dt className="muted">Location</dt>
            <dd>{application.location || "Not specified"}</dd>
          </div>
          <div>
            <dt className="muted">Added</dt>
            <dd>
              {new Date(application.createdAt).toLocaleDateString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="muted">Job link</dt>
            <dd>
              {application.jobUrl ? (
                <a
                  href={application.jobUrl}
                  className="text-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View original offer ↗
                </a>
              ) : (
                "Not specified"
              )}
            </dd>
          </div>
        </dl>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
