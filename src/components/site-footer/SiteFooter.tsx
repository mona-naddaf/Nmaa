import styles from "./site-footer.module.css";

const CONTACT_EMAIL = "namaa.quraan@gmail.com";

// Rendered once by the root layout, so every page (current and future)
// gets it without adding it by hand. Hidden when printing.
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      لديك اقتراح أو واجهت مشكلة؟ راسلنا على{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className={styles.link}>
        <bdi dir="ltr">{CONTACT_EMAIL}</bdi>
      </a>
    </footer>
  );
}
