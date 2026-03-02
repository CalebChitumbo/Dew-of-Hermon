import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const cookieStore = cookies();
    cookieStore.set("session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = cookies();
    cookieStore.delete("session");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
