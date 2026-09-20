"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateUniqueCourseCode, normalizeCourseCode } from "@/lib/auth/course-code";
import { DEFAULT_GROUP_NAMES, DEFAULT_POINTS_ACTIVITIES } from "@/lib/points/defaults";

export type ActionState = { error?: string } | null;

export async function teacherLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCourseCode(String(formData.get("code") ?? ""));

  if (!name || !code) {
    return { error: "يُرجى إدخال الاسم وكود الدورة" };
  }

  const course = await prisma.course.findUnique({ where: { code } });
  if (!course) {
    return { error: "كود الدورة غير صحيح — يُرجى التأكد منه مع مديرة الدورة" };
  }

  const nameKey = name.toLowerCase();
  const teacher = await prisma.teacher.upsert({
    where: { courseId_nameKey: { courseId: course.id, nameKey } },
    update: {},
    create: { courseId: course.id, name, nameKey },
  });

  await createSession({
    role: "teacher",
    teacherId: teacher.id,
    teacherName: teacher.name,
    courseId: course.id,
  });

  redirect("/students");
}

export async function adminSignupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const courseName = String(formData.get("courseName") ?? "").trim();

  if (!email || !password || !courseName) {
    return { error: "يُرجى تعبئة جميع الحقول" };
  }
  if (password.length < 8) {
    return { error: "يُرجى اختيار كلمة مرور لا تقل عن 8 خانات" };
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    return { error: "يوجد حساب مسجَّل بهذا البريد الإلكتروني مسبقًا" };
  }

  const passwordHash = await hashPassword(password);
  const code = await generateUniqueCourseCode();

  const admin = await prisma.admin.create({
    data: {
      email,
      passwordHash,
      course: {
        create: {
          name: courseName,
          code,
          groups: {
            create: DEFAULT_GROUP_NAMES.map((name, i) => ({ name, sortOrder: i })),
          },
          pointsActivities: {
            create: DEFAULT_POINTS_ACTIVITIES.map((a, i) => ({ ...a, sortOrder: i })),
          },
        },
      },
    },
    include: { course: true },
  });

  await createSession({ role: "admin", adminId: admin.id, courseId: admin.course!.id });
  redirect("/settings");
}

export async function adminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "يُرجى تعبئة جميع الحقول" };
  }

  const admin = await prisma.admin.findUnique({ where: { email }, include: { course: true } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };
  }
  if (!admin.course) {
    return { error: "لا توجد دورة مرتبطة بهذا الحساب" };
  }

  await createSession({ role: "admin", adminId: admin.id, courseId: admin.course.id });
  redirect("/settings");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
