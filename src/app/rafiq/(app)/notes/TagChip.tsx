import styles from "./notes.module.css";
import { NOTE_COLORS, type NoteTag } from "@/lib/rafiq/notes-rules";

// One tag in its palette colour. As a button it toggles (on/off); otherwise
// it is a plain label.
export function TagChip({
  tag,
  on,
  onClick,
  disabled,
}: {
  tag: Pick<NoteTag, "name" | "color">;
  on?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const c = NOTE_COLORS[tag.color];
  const style = { background: c.bg, color: c.fg };
  if (!onClick) {
    return (
      <span className={styles.chip} style={style}>
        {tag.name}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${styles.chip} ${on ? styles.chipOn : styles.chipOff}`}
      style={style}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {on && "✓ "}
      {tag.name}
    </button>
  );
}
