import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { SettingsView } from "./SettingsView";

export default async function RafiqSettingsPage() {
  const user = await requireRafiqUser();
  const { recoveryCodeCreatedAt } = await prisma.rafiqUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { recoveryCodeCreatedAt: true },
  });
  return (
    <SettingsView
      email={user.email}
      name={user.name}
      gender={user.gender}
      recoveryCodeCreatedAt={recoveryCodeCreatedAt.toISOString().slice(0, 10)}
    />
  );
}
