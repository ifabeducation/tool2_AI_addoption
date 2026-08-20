import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyFacilitatorToken, FACILITATOR_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = verifyFacilitatorToken(cookieStore.get(FACILITATOR_COOKIE_NAME)?.value);
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, name: token.name });
}
