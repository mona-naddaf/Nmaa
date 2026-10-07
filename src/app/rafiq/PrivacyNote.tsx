import styles from "./rafiq.module.css";

// Shown on sign-up: what is stored and who can see it.
export function PrivacyNote() {
  return (
    <div className={styles.privacy}>
      <b>خصوصيتك:</b> نحفظ بريدك الإلكتروني، وكلمة مرورك بصيغة مُعمّاة لا يمكن استرجاعها، واسمك وجنسك، وما تسجّله من حفظ
      ومتابعة. لا تظهر بياناتك لأحد غيرك داخل المنصّة — لا لمشرفي الدورات ولا للمعلمين ولا لغيرهم من المستخدمين — ولا
      تُشارَك مع أي جهة. ويمكنك حذف حسابك وجميع بياناته نهائيًا في أي وقت من صفحة الإعدادات.
    </div>
  );
}
