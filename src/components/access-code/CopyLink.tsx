"use client";

import { useState } from "react";
import styles from "./access-code.module.css";

// A full login link (e.g. https://alamukth.vercel.app/parent/login) the
// supervisor can copy and send along with a code.
export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the link is still visible to copy by hand
    }
  }

  return (
    <div className={styles.linkRow}>
      <span className={styles.linkLabel}>{label}</span>
      <bdi dir="ltr" className={styles.linkVal}>
        {url}
      </bdi>
      <button type="button" className={styles.btn} style={{ marginTop: 0 }} onClick={copy}>
        {copied ? "تم النسخ ✓" : "نسخ الرابط"}
      </button>
    </div>
  );
}
