"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { request, errorMessage } from "../lib/career";
import type { Profile } from "../lib/career";
import ProfileEditor from "./profile-editor";
import { emptyProfile, sections, contactFields } from "./profile-sections";
import type { EditorSection } from "./profile-sections";
import styles from "./profile.module.css";

function SectionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 380 || text.split("\n").length > 6;
  return (
    <>
      <p
        className={
          styles.sectionText + (!expanded && long ? " " + styles.clamped : "")
        }
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          className={styles.expandButton}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Read full section"}
        </button>
      )}
    </>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<EditorSection | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request<{ content: Profile | null }>("/profile", {
      signal: controller.signal,
    })
      .then((saved) => {
        setProfile(saved?.content || emptyProfile);
        setHasProfile(!!saved?.content);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  async function save(draft: Profile) {
    const saved = await request<{ content: Profile }>("/profile", {
      method: "PUT",
      body: JSON.stringify(draft),
    });
    setProfile(saved.content);
    setHasProfile(true);
    setEditor(null);
    setNotice("Profile saved. Existing resumes stay unchanged.");
  }
  function edit(section: EditorSection) {
    setNotice("");
    setEditor(section);
  }
  const filled = sections.filter((section) =>
    profile[section.key].trim(),
  ).length;
  const initials = profile.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>YOUR EXPERIENCE / YOUR STORY</p>
          <h1>My Profile</h1>
          <p className={styles.subtitle}>
            Your professional story, ready for your next opportunity.
          </p>
        </div>
        <Link className={styles.applicationsLink} href="/">
          View applications <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <div
        role="status"
        className={notice ? styles.success : styles.quietStatus}
      >
        {notice}
      </div>
      {loading ? (
        <div className={styles.loading} role="status">
          Loading your profile…
        </div>
      ) : loadError ? (
        <div className="error" role="alert">
          <p>{loadError}</p>
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
        <>
          {!hasProfile && (
            <section className={styles.welcome} aria-labelledby="welcome-title">
              <div>
                <p className={styles.kicker}>LET’S GET STARTED</p>
                <h2 id="welcome-title">
                  A little about you. A stronger resume.
                </h2>
                <p>
                  Start with your name and skills. Add experience and other
                  details at your own pace.
                </p>
              </div>
              <button onClick={() => edit("setup")}>
                Set up profile <span aria-hidden="true">→</span>
              </button>
            </section>
          )}
          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Profile overview">
              <section className={styles.identity}>
                <div className={styles.avatar} aria-hidden="true">
                  {initials || "JF"}
                </div>
                <h2>{profile.fullName || "Your name goes here"}</h2>
                <p className={styles.headline}>
                  {profile.headline ||
                    "Add a headline that reflects your experience."}
                </p>
                <span className={styles.badge}>
                  {hasProfile ? "Ready to tailor" : "Not set up yet"}
                </span>
                {hasProfile && (
                  <button
                    className={styles.editContact}
                    onClick={() => edit("contact")}
                  >
                    Edit contact & introduction
                  </button>
                )}
                <dl className={styles.contacts}>
                  {contactFields.slice(2).map(
                    ([key, label]) =>
                      profile[key] && (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{profile[key]}</dd>
                        </div>
                      ),
                  )}
                </dl>
                <p className={styles.privacyNote}>
                  Contact details appear in your PDF. They stay out of the
                  prompt you copy.
                </p>
              </section>
              <nav className={styles.sectionNav} aria-label="Profile sections">
                <h2>Your background</h2>
                <p>
                  {filled} of {sections.length} sections added
                </p>
                {sections.map((section) => (
                  <a href={"#section-" + section.key} key={section.key}>
                    <span>{section.title}</span>
                    <span
                      className={
                        profile[section.key].trim()
                          ? styles.addedDot
                          : styles.emptyDot
                      }
                      aria-label={
                        profile[section.key].trim() ? "Added" : "Not added"
                      }
                    />
                  </a>
                ))}
              </nav>
              <p className={styles.sidebarTip}>
                A complete story helps you tailor your resume to different
                roles. Add only experience you can support.
              </p>
            </aside>
            <div className={styles.background}>
              <div className={styles.backgroundHeader}>
                <div>
                  <h2>Professional background</h2>
                  <p>
                    Read your story at a glance. Edit one section at a time.
                  </p>
                </div>
              </div>
              <div className={styles.cardGrid}>
                {sections.map((section, index) => (
                  <section
                    id={"section-" + section.key}
                    key={section.key}
                    aria-labelledby={"title-" + section.key}
                    className={
                      styles.card +
                      (section.key === "experience" || section.key === "skills"
                        ? " " + styles.wideCard
                        : "")
                    }
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>
                        <span
                          className={styles.sectionNumber}
                          aria-hidden="true"
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h3 id={"title-" + section.key}>{section.title}</h3>
                          <p>{section.description}</p>
                        </div>
                      </div>
                      {hasProfile && (
                        <button
                          className={styles.editButton}
                          aria-label={
                            (profile[section.key].trim() ? "Edit " : "Add ") +
                            section.title.toLowerCase()
                          }
                          onClick={() => edit(section.key)}
                        >
                          {profile[section.key].trim() ? "Edit" : "+ Add"}
                        </button>
                      )}
                    </div>
                    {profile[section.key].trim() ? (
                      <SectionText
                        key={profile[section.key]}
                        text={profile[section.key]}
                      />
                    ) : (
                      <div className={styles.emptySection}>
                        <p>No {section.title.toLowerCase()} added yet.</p>
                        <span>{section.help}</span>
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <p className={styles.bottomNote}>
                Your saved background goes into the prompt only when you choose
                to copy it. Updating your profile never changes existing
                resumes.
              </p>
            </div>
          </div>
        </>
      )}
      {editor && (
        <ProfileEditor
          profile={profile}
          section={editor}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </main>
  );
}
