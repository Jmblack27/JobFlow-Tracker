"use client";
import { useId } from "react";
const platforms = ["LinkedIn", "Indeed", "Computrabajo", "Magneto", "Elempleo", "Get on Board", "Wellfound", "Glassdoor", "Company website", "Referral"];
export default function PlatformField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <label>
      Application platform
      <input list={id} value={value} maxLength={200} onChange={(event) => onChange(event.target.value)} placeholder="Choose or type a platform" />
      <datalist id={id}>{platforms.map((platform) => <option key={platform} value={platform} />)}</datalist>
      <span className="field-help">Where you submitted this application. Leave blank if unknown.</span>
    </label>
  );
}
