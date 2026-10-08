import { BrandLogo } from "@/components/brand/BrandLogo";
import shell from "@/app/(dashboard)/shell.module.css";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { rafiqLogoutAction } from "../actions";
import { RafiqTabs } from "./RafiqTabs";
import { getNoteSummary } from "@/lib/rafiq/notes";
import { NotesProvider } from "./notes/NotesProvider";

// Shell for every signed-in «رفيق الحفظ» page. Later phases add their tabs
// in RafiqTabs and their pages next to page.tsx.
export default async function RafiqAreaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRafiqUser();
  // which verses have her notes, for the markers after verse numbers
  const noteSummary = await getNoteSummary(user.id);

  return (
    <div className={shell.shell}>
      <div className={shell.bar}>
        <div className={shell.brand}>
          <BrandLogo variant="header" priority />
        </div>
        <RafiqTabs />
        <div className={shell.who}>
          <span>
            {user.name && (
              <>
                <b>{user.name}</b> ·{" "}
              </>
            )}
            رفيق الحفظ
          </span>
          <form action={rafiqLogoutAction}>
            <button className={shell.logoutBtn} type="submit">
              خروج
            </button>
          </form>
        </div>
      </div>
      <div className={shell.content}>
        <NotesProvider summary={noteSummary} g={user.gender === "FEMALE" ? "GIRLS" : "BOYS"}>
          {children}
        </NotesProvider>
      </div>
    </div>
  );
}
