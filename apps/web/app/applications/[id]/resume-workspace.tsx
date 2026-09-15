"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { request, errorMessage } from "../../lib/career";
import type { Workspace, Resume } from "../../lib/career";
import ResumeEditor, { Evidence } from "./resume-editor";

export default function ResumeWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const promptField = useRef<HTMLTextAreaElement>(null);
  const base = "/applications/" + id;

  useEffect(() => {
    const controller = new AbortController();
    request<Workspace>(base + "/resume-workspace", {
      signal: controller.signal,
    })
      .then((workspace) => {
        setData(workspace);
        setDescription(workspace.application.jobDescription || "");
        setSelected(workspace.resumes[0]?.id || "");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, attempt]);

  async function saveDescription() {
    setBusy("description");
    setError("");
    setNotice("");
    try {
      const saved = await request<{ jobDescription: string }>(
        base + "/description",
        {
          method: "PUT",
          body: JSON.stringify({ jobDescription: description }),
        },
      );
      setDescription(saved.jobDescription);
      setPrompt("");
      setData(
        (current) =>
          current && {
            ...current,
            application: {
              ...current.application,
              jobDescription: saved.jobDescription,
            },
            analysisCurrent: false,
          },
      );
      setNotice("Job description saved. Prepare a new prompt for this offer.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function prepare() {
    setBusy("prompt");
    setError("");
    setNotice("");
    try {
      const result = await request<{ prompt: string }>(base + "/resume-prompt");
      setPrompt(result.prompt);
      setNotice(
        "Prompt ready. Copy it into ChatGPT, then paste the complete response below.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("Prompt copied. Paste it into ChatGPT.");
    } catch {
      promptField.current?.focus();
      promptField.current?.select();
      setNotice("Copy the selected prompt with Ctrl+C or Command+C.");
    }
  }

  async function importResponse() {
    setBusy("import");
    setError("");
    setNotice("");
    try {
      const saved = await request<Resume>(base + "/resumes/import", {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      // Update locally first so a failed refresh cannot hide a successful import.
      setData(
        (current) =>
          current && { ...current, resumes: [saved, ...current.resumes] },
      );
      setSelected(saved.id);
      setResponse("");
      setNotice(
        "Resume imported. Review the draft and save it before downloading PDF.",
      );
      try {
        const workspace = await request<Workspace>(base + "/resume-workspace");
        setData(workspace);
      } catch {
        setNotice(
          "Resume imported successfully. Reload this page to refresh the offer analysis.",
        );
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  const dirtyDescription =
    description !== (data?.application.jobDescription || "");
  const activeResume = data?.resumes.find((resume) => resume.id === selected);
  return (
    <main className="career-page">
      <Link className="back-link" href="/">
        ← Applications
      </Link>
      {loading ? (
        <p role="status">Loading resume workspace…</p>
      ) : loadError ? (
        <div className="error" role="alert">
          {loadError}
          <button
            onClick={() => {
              setLoadError("");
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            Retry loading
          </button>
        </div>
      ) : (
        data && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">{data.application.company.name}</p>
                <h1>{data.application.position}</h1>
                <p>
                  Use ChatGPT manually, then review and download your resume as
                  a PDF. No API key needed.
                </p>
              </div>
              <Link className="text-link" href="/profile">
                Edit My Profile ↗
              </Link>
            </header>
            <div className="career-columns">
              <div>
                <section className="career-panel" aria-label="Job description">
                  <h2>1. Save the job description</h2>
                  <p className="muted">
                    Paste the full offer, including responsibilities and
                    requirements.
                  </p>
                  <label>
                    Job description
                    <textarea
                      rows={10}
                      minLength={50}
                      maxLength={20000}
                      value={description}
                      disabled={!!busy}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                  <p className="field-help">
                    {description.trim().length} / 20,000 characters · Minimum 50
                  </p>
                  <button
                    disabled={
                      !!busy ||
                      !dirtyDescription ||
                      description.trim().length < 50
                    }
                    onClick={() => void saveDescription()}
                  >
                    {busy === "description" ? "Saving…" : "Save description"}
                  </button>
                </section>
                <section className="career-panel" aria-label="ChatGPT prompt">
                  <h2>2. Copy your prompt to ChatGPT</h2>
                  {!data.hasProfile && (
                    <p className="empty-board">
                      Start by saving{" "}
                      <Link className="text-link" href="/profile">
                        My Profile
                      </Link>{" "}
                      with your skills and experience.
                    </p>
                  )}
                  <p className="muted">
                    JobFlow prepares the prompt locally. You choose when to
                    paste it into ChatGPT. It includes your saved background and
                    the offer, excluding separate contact fields.
                  </p>
                  <button
                    disabled={
                      !!busy ||
                      !data.hasProfile ||
                      !data.application.jobDescription ||
                      dirtyDescription
                    }
                    onClick={() => void prepare()}
                  >
                    {busy === "prompt" ? "Preparing…" : "Prepare prompt"}
                  </button>
                  {dirtyDescription && (
                    <p className="field-help">
                      Save the description before preparing a prompt or
                      importing a response.
                    </p>
                  )}
                  {prompt && (
                    <>
                      <label className="history-label">
                        Prompt to copy
                        <textarea
                          ref={promptField}
                          rows={10}
                          readOnly
                          value={prompt}
                        />
                      </label>
                      <div className="action-row">
                        <button
                          className="secondary"
                          disabled={!!busy || dirtyDescription}
                          onClick={() => void copy()}
                        >
                          Copy prompt
                        </button>
                        <a
                          className="text-link"
                          href="https://chatgpt.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open ChatGPT ↗
                        </a>
                      </div>
                      <p className="field-help">
                        Paste this prompt into a chat and copy the complete
                        response it produces. Your ChatGPT plan limits still
                        apply.
                      </p>
                    </>
                  )}
                </section>
                {data.analysis && (
                  <section className="career-panel" aria-label="Offer analysis">
                    <h2>Imported offer analysis</h2>
                    {(!data.analysisCurrent || dirtyDescription) && (
                      <p className="stale-notice">
                        Your profile or offer changed. Prepare a new prompt for
                        your next resume. Existing versions are preserved.
                      </p>
                    )}
                    <p className="analysis-summary">
                      {data.analysis.content.roleSummary}
                    </p>
                    <h3>Matching skills</h3>
                    {!data.analysis.content.matchingSkills.length && (
                      <p className="muted">No supported matches found.</p>
                    )}
                    {data.analysis.content.matchingSkills.map(
                      (match, index) => (
                        <div className="match" key={index}>
                          <p>{match.requirement}</p>
                          <Evidence claim={match} />
                        </div>
                      ),
                    )}
                    <h3>Missing requirements</h3>
                    <ul className="analysis-list">
                      {data.analysis.content.missingRequirements.map(
                        (gap, index) => (
                          <li key={index}>{gap}</li>
                        ),
                      )}
                    </ul>
                    {!data.analysis.content.missingRequirements.length && (
                      <p className="muted">
                        No missing requirements identified. Review the offer to
                        confirm.
                      </p>
                    )}
                    {!!data.analysis.content.questions.length && (
                      <>
                        <h3>Clarify in your profile</h3>
                        <ul className="analysis-list">
                          {data.analysis.content.questions.map(
                            (question, index) => (
                              <li key={index}>{question}</li>
                            ),
                          )}
                        </ul>
                      </>
                    )}
                  </section>
                )}
              </div>
              <div>
                <section
                  className="career-panel"
                  aria-label="Import ChatGPT response"
                >
                  <h2>3. Paste the response</h2>
                  <p className="muted">
                    Copy the complete response from ChatGPT, including the JSON
                    block. JobFlow validates it and turns it into an editable
                    resume.
                  </p>
                  <label>
                    ChatGPT response
                    <textarea
                      rows={12}
                      value={response}
                      maxLength={80000}
                      disabled={!!busy}
                      placeholder="Paste the complete ChatGPT response here."
                      onChange={(event) => setResponse(event.target.value)}
                    />
                  </label>
                  <p className="field-help">
                    {response.length} / 80,000 characters
                  </p>
                  <button
                    disabled={
                      !!busy ||
                      !data.hasProfile ||
                      !data.application.jobDescription ||
                      dirtyDescription ||
                      editorDirty ||
                      !response.trim()
                    }
                    onClick={() => void importResponse()}
                  >
                    {busy === "import" ? "Importing…" : "Import resume"}
                  </button>
                  {editorDirty && (
                    <p className="field-help">
                      Save or discard resume edits before importing or switching
                      versions.
                    </p>
                  )}
                </section>
                <section className="career-panel" aria-label="Resume history">
                  <h2>4. Review & download PDF</h2>
                  <p className="muted">
                    Each import creates a separate version. Edit the draft,
                    confirm your review and save to download a PDF.
                  </p>
                  {data.resumes.length ? (
                    <label className="history-label">
                      Resume version
                      <select
                        value={selected}
                        disabled={!!busy || editorDirty}
                        onChange={(event) => setSelected(event.target.value)}
                      >
                        {data.resumes.map((resume, index) => (
                          <option key={resume.id} value={resume.id}>
                            Version {data.resumes.length - index} ·{" "}
                            {new Date(resume.createdAt).toLocaleString("en-US")}{" "}
                            · {resume.reviewedAt ? "Reviewed" : "Draft"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="empty-board">
                      Your imported resume drafts will appear here.
                    </p>
                  )}
                </section>
                {activeResume && (
                  <ResumeEditor
                    key={activeResume.id + activeResume.updatedAt}
                    resume={activeResume}
                    applicationId={id}
                    onDirty={setEditorDirty}
                    onSaved={(saved) => {
                      setData(
                        (current) =>
                          current && {
                            ...current,
                            resumes: current.resumes.map((r) =>
                              r.id === saved.id ? saved : r,
                            ),
                          },
                      );
                      setNotice(
                        saved.reviewedAt
                          ? "Reviewed resume saved. PDF download is ready."
                          : "Draft saved.",
                      );
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p role="status" className="feedback">
        {notice}
      </p>
    </main>
  );
}
