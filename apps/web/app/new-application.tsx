"use client";
import Link from "next/link";
import PlatformField from "./platform-field";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { request, errorMessage } from "./lib/career";
import type { Analysis, ResumeContent } from "./lib/career";
import { stages, categories } from "./lib/applications";
import type { Application, Status, Category } from "./lib/applications";
import { Evidence } from "./applications/[id]/resume-editor";
import styles from "./applications.module.css";

type Details = {
  companyName: string;
  position: string;
  location: string;
  jobUrl: string;
  platform: string;
  status: Status;
  category: Category;
};
type Preview = {
  sourceId: string;
  application: Omit<Details, "status" | "platform">;
  analysis: Analysis["content"];
  resume: ResumeContent;
};
export default function NewApplication({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (application: Application) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const promptField = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<Details>({
    companyName: "",
    position: "",
    location: "",
    jobUrl: "",
    platform: "",
    status: "WISHLIST",
    category: "UNCATEGORIZED",
  });
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discard, setDiscard] = useState(false);
  const changed = !!(
    description ||
    response ||
    details.companyName ||
    details.position ||
    details.location ||
    details.jobUrl ||
    details.platform ||
    details.status !== "WISHLIST" ||
    details.category !== "UNCATEGORIZED"
  );
  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    element.querySelector("textarea")?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  function close() {
    if (!busy) {
      if (changed) setDiscard(true);
      else onClose();
    }
  }
  function go(next: number) {
    setStep(next);
    setError("");
    setNotice("");
    heading.current?.focus();
  }
  async function prepare() {
    setBusy("prompt");
    setError("");
    try {
      const result = await request<{ prompt: string }>(
        "/application-drafts/prompt",
        {
          method: "POST",
          body: JSON.stringify({ jobDescription: description }),
        },
      );
      setPrompt(result.prompt);
      go(1);
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
    setBusy("preview");
    setError("");
    try {
      const result = await request<Preview>("/application-drafts/preview", {
        method: "POST",
        body: JSON.stringify({ jobDescription: description, response }),
      });
      setPreview(result);
      setDetails((current) => ({
        ...current,
        ...result.application,
        jobUrl: result.application.jobUrl || current.jobUrl,
      }));
      go(2);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1 || busy) return;
    setBusy("save");
    setError("");
    try {
      const application = await request<Application>(
        preview && step === 2 ? "/application-drafts" : "/applications",
        {
          method: "POST",
          body: JSON.stringify(
            preview && step === 2
              ? {
                  jobDescription: description,
                  application: details,
                  response: JSON.stringify(preview),
                }
              : { ...details, jobDescription: description },
          ),
        },
      );
      onCreated(application);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  const fields = (
    <div className={styles.fields}>
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
          {(key === "companyName" || key === "position") && (
            <span className="field-help" aria-hidden="true">
              Required to save
            </span>
          )}
          <input
            type={key === "jobUrl" ? "url" : "text"}
            required={key === "companyName" || key === "position"}
            maxLength={key === "jobUrl" ? 2048 : 200}
            value={details[key]}
            onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
            placeholder={
              key === "jobUrl" ? "https://" : "Not specified in the offer"
            }
          />
        </label>
      ))}
      <PlatformField value={details.platform} onChange={(platform) => setDetails({ ...details, platform })} />
      <label>
        Job category
        <select
          value={details.category}
          onChange={(e) =>
            setDetails({ ...details, category: e.target.value as Category })
          }
        >
          {categories.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="field-help">
          Organize your search across IT and other fields.
        </span>
      </label>
      <label>
        Stage
        <select
          value={details.status}
          onChange={(e) =>
            setDetails({ ...details, status: e.target.value as Status })
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
  );
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="new-application-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={save} className={styles.form}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">A NEW OPPORTUNITY</p>
            <h2 ref={heading} tabIndex={-1} id="new-application-title">
              {
                [
                  "Start with the job offer",
                  "Prepare with ChatGPT",
                  "Review your application",
                ][step]
              }
            </h2>
          </div>
          <button
            type="button"
            className="secondary"
            aria-label="Close new application"
            disabled={!!busy}
            onClick={close}
          >
            ×
          </button>
        </header>
        <ol className={styles.steps} aria-label="Creation progress">
          {["Job offer", "ChatGPT", "Review & save"].map((name, index) => (
            <li key={name} aria-current={step === index ? "step" : undefined}>
              <span>{index + 1}</span>
              {name}
            </li>
          ))}
        </ol>
        <div className={styles.body}>
          <fieldset disabled={!!busy} className={styles.fieldset}>
            {step === 0 && (
              <>
                <p className="muted">
                  Paste the offer once. ChatGPT can extract the role details and
                  draft a resume using your saved profile.
                </p>
                <label>
                  Job description
                  <textarea
                    rows={9}
                    maxLength={20000}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setPrompt("");
                      setPreview(null);
                      setResponse("");
                    }}
                    placeholder="Paste the responsibilities, requirements and company details here…"
                  />
                </label>
                <p className="field-help">
                  {description.trim().length.toLocaleString("en-US")} / 20,000
                  characters · At least 50 to prepare a prompt
                </p>
                <p className="field-help">
                  Use your saved{" "}
                  <Link
                    className="text-link"
                    href="/profile"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    My Profile ↗
                  </Link>{" "}
                  for resume content. No API key needed.
                </p>
                <h3 className={styles.sectionTitle}>Application details</h3>
                <p className="muted">
                  ChatGPT fills these in next. You can also complete them and
                  save without a resume.
                </p>
                {fields}
              </>
            )}
            {step === 1 && (
              <>
                <p className="muted">
                  Copy this prompt into ChatGPT, then paste its complete JSON
                  response below. It includes your background and this offer,
                  excluding separate contact fields.
                </p>
                <label>
                  Prompt to copy
                  <textarea
                    ref={promptField}
                    rows={5}
                    readOnly
                    value={prompt}
                  />
                </label>
                <div className={styles.actions}>
                  <button type="button" onClick={() => void copy()}>
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
                <label>
                  ChatGPT response
                  <textarea
                    rows={7}
                    maxLength={80000}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Paste the complete JSON response here…"
                  />
                </label>
                <p className="field-help">
                  Nothing is saved until you review and confirm. Your ChatGPT
                  plan limits apply.
                </p>
              </>
            )}
            {step === 2 && preview && (
              <>
                <p className="muted">
                  Check the extracted details and edit the resume draft. Missing
                  information stays blank; complete the required fields before
                  saving.
                </p>
                {fields}
                <section className={styles.preview}>
                  <h3>Offer analysis</h3>
                  <p>{preview.analysis.roleSummary}</p>
                  <h4>Matching skills</h4>
                  {preview.analysis.matchingSkills.length ? (
                    preview.analysis.matchingSkills.map((match, i) => (
                      <div key={i}>
                        <p>{match.requirement}</p>
                        <Evidence claim={match} />
                      </div>
                    ))
                  ) : (
                    <p>No supported matches found.</p>
                  )}
                  <h4>Missing requirements</h4>
                  <ul>
                    {preview.analysis.missingRequirements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                  {!preview.analysis.missingRequirements.length && (
                    <p>No gaps identified. Check the offer to confirm.</p>
                  )}
                  {!!preview.analysis.questions.length && (
                    <>
                      <h4>Questions to clarify</h4>
                      <ul>
                        {preview.analysis.questions.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
                <section className={styles.preview}>
                  <h3>Resume draft</h3>
                  <p className="field-help">
                    Edit the wording while keeping claims truthful. You can
                    confirm the final review and download PDF after saving.
                  </p>
                  <label>
                    Summary
                    <textarea
                      rows={4}
                      required
                      maxLength={2000}
                      value={preview.resume.summary.text}
                      onChange={(e) =>
                        setPreview({
                          ...preview,
                          resume: {
                            ...preview.resume,
                            summary: {
                              ...preview.resume.summary,
                              text: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <Evidence claim={preview.resume.summary} />
                  {preview.resume.sections.map((section, si) => (
                    <div key={section.title}>
                      <h4>{section.title}</h4>
                      {section.items.map((item, ii) => (
                        <div key={ii}>
                          <label>
                            {section.title} item {ii + 1}
                            <textarea
                              rows={3}
                              required
                              maxLength={2000}
                              value={item.text}
                              onChange={(e) =>
                                setPreview({
                                  ...preview,
                                  resume: {
                                    ...preview.resume,
                                    sections: preview.resume.sections.map(
                                      (s, index) =>
                                        index === si
                                          ? {
                                              ...s,
                                              items: s.items.map((it, index) =>
                                                index === ii
                                                  ? {
                                                      ...it,
                                                      text: e.target.value,
                                                    }
                                                  : it,
                                              ),
                                            }
                                          : s,
                                    ),
                                  },
                                })
                              }
                            />
                          </label>
                          <Evidence claim={item} />
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
              </>
            )}
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="feedback" role="status">
            {notice}
          </p>
          {discard && (
            <div className="stale-notice" role="alert">
              <strong>Discard this application draft?</strong>
              <p>Your unsaved offer and edits will be lost.</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDiscard(false)}
                >
                  Keep editing
                </button>
                <button type="button" onClick={onClose}>
                  Discard draft
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className={styles.footer}>
          <button
            type="button"
            className="secondary"
            disabled={!!busy}
            onClick={step ? () => go(step - 1) : close}
          >
            {step ? "Back" : "Cancel"}
          </button>
          <div className={styles.actions}>
            {step === 0 && (
              <>
                <button type="submit" className="secondary" disabled={!!busy}>
                  Save without resume
                </button>
                <button
                  type="button"
                  disabled={!!busy || description.trim().length < 50}
                  onClick={() => void prepare()}
                >
                  {busy === "prompt" ? "Preparing…" : "Continue with ChatGPT →"}
                </button>
              </>
            )}
            {step === 1 && (
              <button
                type="button"
                disabled={!!busy || !response.trim()}
                onClick={() => void importResponse()}
              >
                {busy === "preview" ? "Validating…" : "Preview application →"}
              </button>
            )}
            {step === 2 && (
              <button type="submit" disabled={!!busy}>
                {busy === "save" ? "Saving…" : "Save application & resume"}
              </button>
            )}
          </div>
        </footer>
      </form>
    </dialog>
  );
}
