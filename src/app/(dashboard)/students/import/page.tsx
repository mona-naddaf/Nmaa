import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/require";
import { getImportAccess } from "@/lib/students/import-access";
import { ImportForm } from "./ImportForm";

export default async function ImportStudentsPage() {
  const session = await requireSession();
  const access = await getImportAccess(session);
  if (!access) redirect("/students");

  return (
    <ImportForm
      viewerGender={access.viewerGender}
      hasGroups={access.groups.length > 0}
      isSupervisor={session.role === "admin"}
    />
  );
}
