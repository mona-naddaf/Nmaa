import { redirect } from "next/navigation";
import { getBoardCourseId } from "@/lib/auth/board-session";
import { BoardLoginForm } from "./BoardLoginForm";

export default async function BoardLoginPage() {
  if (await getBoardCourseId()) redirect("/board");
  return <BoardLoginForm />;
}
