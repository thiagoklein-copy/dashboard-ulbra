import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  bloqueado,
  criarToken,
  isValidPassword,
  limparTentativas,
  registrarFalha,
} from "@/lib/auth";

/** Origem da tentativa, para o limite de força bruta. */
function origem(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "desconhecida"
  );
}

export async function POST(request: NextRequest) {
  const quem = origem(request);

  if (bloqueado(quem)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };

  if (!isValidPassword(body.password ?? "")) {
    registrarFalha(quem);
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  limparTentativas(quem);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, await criarToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
