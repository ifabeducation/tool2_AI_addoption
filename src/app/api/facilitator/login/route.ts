import { NextResponse } from "next/server";
import { createFacilitatorToken, FACILITATOR_COOKIE_NAME, FACILITATOR_COOKIE_MAX_AGE } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, password } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome mancante" }, { status: 400 });
  }

  const expected = process.env.FACILITATOR_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "FACILITATOR_PASSWORD non configurata sul server" },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Password non corretta" }, { status: 401 });
  }

  const token = createFacilitatorToken(name.trim());
  const res = NextResponse.json({ ok: true, name: name.trim() });
  res.cookies.set(FACILITATOR_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FACILITATOR_COOKIE_MAX_AGE,
  });
  return res;
}
