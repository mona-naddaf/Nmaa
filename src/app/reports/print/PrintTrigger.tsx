"use client";

import { useEffect } from "react";
import styles from "./print.module.css";

export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <button className={`${styles.printBtn} ${styles.noPrint}`} onClick={() => window.print()} type="button">
      🖨️ طباعة / حفظ كملف PDF
    </button>
  );
}
