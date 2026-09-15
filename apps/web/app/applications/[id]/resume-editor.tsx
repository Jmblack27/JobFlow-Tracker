"use client";

import { useState } from "react";
import type { Claim, Resume, ResumeContent } from "../../lib/career";
import { request, errorMessage } from "../../lib/career";

export function Evidence({
  claim,
}: {
  claim: { evidence: Claim["evidence"] };
}) {
  return (
    <details className="evidence">
      <summary>Source evidence</summary>
      {claim.evidence.map((source, index) => (
        <blockquote key={index}>
          <strong>{source.section}</strong>
          <p>{source.quote}</p>
        </blockquote>
      ))}
    </details>
  );
}

export default function ResumeEditor({
  resume,
  applicationId,
  onSaved,
  onDirty,
}: {
  resume: Resume;
  applicationId: string;
  onSaved: (resume: Resume) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [content, setContent] = useState<ResumeContent>(resume.content);
  const [reviewed, setReviewed] = useState(!!resume.reviewedAt);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function changed(next: ResumeContent) {
    setContent(next);
    setReviewed(false);
    setDirty(true);
    onDirty(true);
    setNotice("");
  }
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await request<Resume>(
        "/applications/" + applicationId + "/resumes/" + resume.id,
        {
          method: "PATCH",
          body: JSON.stringify({
            content,
            reviewed,
            updatedAt: resume.updatedAt,
          }),
        },
      );
      setDirty(false);
      onDirty(false);
      onSaved(saved);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/applications/" + applicationId + "/resumes/" + resume.id + "/pdf",
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Could not download this resume.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "resume.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("PDF downloaded.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const profile = resume.profileSnapshot;
  return (
    <section className="career-panel resume-editor" aria-label="Resume editor">
      <header className="section-header">
        <div>
          <h2>Review your resume</h2>
          <p className="muted">
            Edit the wording and check every claim against your experience.
            Edits do not change My Profile.
          </p>
        </div>
        <span className="status-pill">
          {resume.reviewedAt && !dirty ? "Reviewed" : "Draft"}
        </span>
      </header>
      <fieldset disabled={busy}>
        <div className="resume-preview">
          <h2>{profile.fullName}</h2>
          <p>{profile.headline}</p>
          <p className="muted">
            {[profile.email, profile.phone, profile.location, profile.links]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <label>
            Professional summary
            <textarea
              rows={4}
              maxLength={2000}
              value={content.summary.text}
              onChange={(event) =>
                changed({
                  ...content,
                  summary: { ...content.summary, text: event.target.value },
                })
              }
            />
          </label>
          <Evidence claim={content.summary} />
          {content.sections.map((section, sectionIndex) => (
            <section className="resume-section" key={sectionIndex}>
              <h3>{section.title}</h3>
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex}>
                  <label>
                    {section.title} item {itemIndex + 1}
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={item.text}
                      onChange={(event) =>
                        changed({
                          ...content,
                          sections: content.sections.map((s, si) =>
                            si === sectionIndex
                              ? {
                                  ...s,
                                  items: s.items.map((entry, ei) =>
                                    ei === itemIndex
                                      ? { ...entry, text: event.target.value }
                                      : entry,
                                  ),
                                }
                              : s,
                          ),
                        })
                      }
                    />
                  </label>
                  <Evidence claim={item} />
                </div>
              ))}
            </section>
          ))}
        </div>
        <label className="review-check">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => {
              setReviewed(event.target.checked);
              setDirty(true);
              onDirty(true);
            }}
          />
          I reviewed this resume and confirm it reflects my experience.
        </label>
        <div className="action-row">
          <button onClick={() => void save()} disabled={!dirty}>
            {busy ? "Working…" : "Save resume"}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setContent(resume.content);
              setReviewed(!!resume.reviewedAt);
              setDirty(false);
              onDirty(false);
              setError("");
            }}
            disabled={!dirty}
          >
            Discard edits
          </button>
          <button
            className="secondary"
            onClick={() => void download()}
            disabled={dirty || !resume.reviewedAt}
          >
            Download PDF
          </button>
        </div>
        {!resume.reviewedAt && (
          <p className="field-help">
            Confirm your review and save to enable PDF download.
          </p>
        )}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p role="status" className="feedback">
        {notice}
      </p>
    </section>
  );
}
