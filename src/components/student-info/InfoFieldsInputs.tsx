"use client";

import styles from "./student-info.module.css";
import {
  fieldLabel,
  isMultilineField,
  isPhoneField,
  maxValueLength,
  type InfoField,
} from "@/lib/students/extra-info-rules";
import type { GroupGender } from "@/lib/text/gender";

/**
 * Inputs for the extra-info fields someone may edit, in field order. Used
 * by the staff edit dialog, the new-student form and the parent portal;
 * each passes its own field/input classes so the inputs match the form.
 * The server checks everything again (src/lib/students/extra-info-rules.ts).
 */
export function InfoFieldsInputs({
  fields,
  values,
  onChange,
  groupGender,
  classes,
  idPrefix,
  title = "معلومات إضافية",
}: {
  fields: InfoField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  groupGender: GroupGender;
  classes: { field: string; input: string };
  idPrefix: string;
  title?: string | null;
}) {
  if (fields.length === 0) return null;
  return (
    <>
      {title && <div className={styles.subTitle}>{title}</div>}
      {fields.map((f) => {
        const id = `${idPrefix}-${f.id}`;
        const label = fieldLabel(f, groupGender);
        const common = {
          id,
          className: classes.input,
          value: values[f.id] ?? "",
          maxLength: maxValueLength(f),
          required: f.required,
        };
        return (
          <div className={classes.field} key={f.id}>
            <label htmlFor={id}>
              {label}
              {!f.required && " (اختياري)"}
            </label>
            {isMultilineField(f) ? (
              <textarea
                {...common}
                className={`${classes.input} ${styles.textarea}`}
                rows={3}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            ) : (
              <input
                {...common}
                type={isPhoneField(f) ? "tel" : "text"}
                inputMode={isPhoneField(f) ? "tel" : undefined}
                dir={isPhoneField(f) ? "ltr" : undefined}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
