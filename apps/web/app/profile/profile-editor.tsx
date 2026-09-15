"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../lib/career";
import { errorMessage } from "../lib/career";
import { contactFields, sections } from "./profile-sections";
import type { EditorSection } from "./profile-sections";
import styles from "./profile.module.css";

export default function ProfileEditor({
  profile,
  section,
  onSave,
  onClose,
}: {
  profile: Profile;
  section: EditorSection;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(profile);
  const definition = sections.find((item) => item.key === section);
  const title =
    section === "setup"
      ? "Set up your profile"
      : section === "contact"
        ? "Edit contact & introduction"
        : "Edit " + definition!.title.toLowerCase();

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    element.querySelector<HTMLElement>("input, textarea")?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function close() {
    if (saving) return;
    if (changed) setConfirmDiscard(true);
    else onClose();
  }
  function update(key: keyof Profile, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setConfirmDiscard(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setConfirmDiscard(false);
    try {
      await onSave(draft);
    } catch (error) {
      setError(errorMessage(error));
      setSaving(false);
    }
  }

  const editedSections =
    section === "setup" ? [sections[0]] : definition ? [definition] : [];
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="profile-editor-title"
      aria-describedby="profile-editor-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit} className={styles.editorForm}>
        <header className={styles.editorHeader}>
          <div>
            <p className={styles.kicker}>MY PROFILE</p>
            <h2 id="profile-editor-title">{title}</h2>
            <p id="profile-editor-description">
              {section === "setup"
                ? "Start with your name and skills. You can add the rest whenever you’re ready."
                : "Update this section. Your existing resumes will stay unchanged."}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close editor"
            disabled={saving}
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className={styles.editorBody}>
          <fieldset className={styles.fields} disabled={saving}>
            {(section === "contact" || section === "setup") && (
              <div className={styles.contactGrid}>
                {(section === "setup"
                  ? contactFields.slice(0, 2)
                  : contactFields
                ).map(([key, label]) => (
                  <label key={key} htmlFor={"profile-" + key}>
                    {label}
                    {key === "fullName" && (
                      <span className={styles.required} aria-hidden="true">
                        Required
                      </span>
                    )}
                    <input
                      id={"profile-" + key}
                      type={
                        key === "email"
                          ? "email"
                          : key === "phone"
                            ? "tel"
                            : "text"
                      }
                      autoComplete={
                        key === "fullName"
                          ? "name"
                          : key === "email"
                            ? "email"
                            : key === "phone"
                              ? "tel"
                              : "off"
                      }
                      required={key === "fullName"}
                      maxLength={key === "links" ? 1000 : 200}
                      value={draft[key]}
                      onChange={(event) => update(key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
            {editedSections.map((item) => (
              <div key={item.key} className={styles.sectionField}>
                <label htmlFor={"profile-" + item.key}>
                  {item.title}
                  {item.key === "skills" && (
                    <span className={styles.required} aria-hidden="true">
                      Required
                    </span>
                  )}
                </label>
                <p id={"help-" + item.key} className={styles.help}>
                  {item.help}
                </p>
                <textarea
                  id={"profile-" + item.key}
                  aria-describedby={"help-" + item.key}
                  rows={section === "setup" ? 5 : 10}
                  required={item.key === "skills"}
                  maxLength={8000}
                  placeholder={item.placeholder}
                  value={draft[item.key]}
                  onChange={(event) => update(item.key, event.target.value)}
                />
                <p className={styles.characterCount}>
                  {draft[item.key].length.toLocaleString("en-US")} / 8,000
                  characters
                </p>
              </div>
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {confirmDiscard && (
            <div className={styles.discard} role="alert">
              <strong>Discard unsaved changes?</strong>
              <p>Your saved profile will stay as it is.</p>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setConfirmDiscard(false)}
                >
                  Keep editing
                </button>
                <button type="button" onClick={onClose}>
                  Discard changes
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className={styles.editorFooter}>
          <span className={styles.help}>
            {saving
              ? "Saving your changes…"
              : changed
                ? "You have unsaved changes."
                : "No changes yet."}
          </span>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving || !changed}>
              {saving
                ? "Saving…"
                : section === "setup"
                  ? "Save profile"
                  : "Save changes"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
