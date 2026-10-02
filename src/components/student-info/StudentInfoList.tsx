import styles from "./student-info.module.css";

export interface InfoDisplayItem {
  id: string;
  label: string;
  value: string;
  phone: boolean;
  multiline: boolean;
  // last saved by the parent (shown to staff only)
  byParent?: boolean;
}

/**
 * The filled extra-info fields a viewer may see, as a compact two-column
 * list. Callers pass only what that viewer is allowed to see; renders
 * nothing when there's nothing filled. bare = just the list, for use
 * inside a card that already has the title.
 */
export function StudentInfoList({ title, items, bare = false }: { title: string; items: InfoDisplayItem[]; bare?: boolean }) {
  if (items.length === 0) return null;
  const list = (
    <dl className={styles.list} aria-label={bare ? title : undefined}>
      {items.map((item) => (
        <div key={item.id} className={`${styles.item} ${item.multiline ? styles.wide : ""}`}>
          <dt>
            {item.label}
            {item.byParent && <span className={styles.byParent}>حدّثها وليّ الأمر</span>}
          </dt>
          <dd>{item.phone ? <bdi dir="ltr">{item.value}</bdi> : item.value}</dd>
        </div>
      ))}
    </dl>
  );
  if (bare) return list;
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.title}>{title}</div>
      {list}
    </section>
  );
}

/** «معلومات ناقصة»: listed field names in the tooltip. */
export function MissingInfoBadge({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <span className={styles.missingBadge} title={`حقول إلزامية فارغة: ${missing.join("، ")}`}>
      معلومات ناقصة
    </span>
  );
}
