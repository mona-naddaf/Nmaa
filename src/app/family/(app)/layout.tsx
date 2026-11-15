import { BrandLogo } from "@/components/brand/BrandLogo";
import shell from "@/app/(dashboard)/shell.module.css";
import { requireFamilyChild } from "@/lib/family/child-session";
import { childLogoutAction } from "../actions";
import { ChildTabs } from "./ChildTabs";
import { childFlags } from "@/lib/family/child-pages";
import { childGuideProps } from "@/lib/family/guide-pages";
import { ChildGuideShell } from "@/components/guide/family/FamilyGuideShells";

// Shell for every page of a signed-in child («العائلة»): her page and her
// tracker in step 3; later steps add their tabs in ChildTabs.
export default async function ChildAreaLayout({ children }: { children: React.ReactNode }) {
  const child = await requireFamilyChild();
  const flags = await childFlags(child.id);
  // «العائلة»'s guide (FAMILY_GUIDE_EMAILS): null, and nothing of it here, unless it reaches her family
  const guide = await childGuideProps(child.id);
  return (
    <div className={shell.shell}>
      <div className={shell.bar}>
        <div className={shell.brand}>
          <BrandLogo variant="header" priority />
        </div>
        <ChildTabs homeLog={flags.homeLog} />
        <div className={shell.who}>
          <span>
            <b>{child.name}</b> · {child.familyName}
          </span>
          <form action={childLogoutAction}>
            <button className={shell.logoutBtn} type="submit">
              خروج
            </button>
          </form>
        </div>
      </div>
      <div className={shell.content}>{guide ? <ChildGuideShell guide={guide}>{children}</ChildGuideShell> : children}</div>
    </div>
  );
}
