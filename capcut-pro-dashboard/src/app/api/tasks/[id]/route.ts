import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper } from "@/lib/auth";

// PATCH /api/tasks/[id] — edit task
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { title, description, isActive } = await req.json();

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return NextResponse.json({ task });
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] — delete task + all assignments
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
