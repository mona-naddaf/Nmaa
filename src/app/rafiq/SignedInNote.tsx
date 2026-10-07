import Link from "next/link";
import login from "@/app/login/login.module.css";

// On the sign-up / recovery pages when a session is already open.
export function SignedInNote() {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ marginTop: 0, fontSize: 14 }}>تم تسجيل دخولك في رفيق الحفظ.</p>
      <Link href="/rafiq" className={login.primaryBtn} style={{ display: "block", textDecoration: "none" }}>
        الذهاب إلى صفحتي
      </Link>
    </div>
  );
}
