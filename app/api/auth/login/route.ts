import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  bloqueado,
  criarToken,
  isValidPassword,
  limparTentativas,
  registrarFalha,
} from "@/lib/auth";

/**
 * Origem da tentativa, para o limite de força bruta.
 *
 * A ÚLTIMA entrada do `X-Forwarded-For`, não a primeira.
 *
 * A cadeia é `cliente, proxy1, proxy2`: cada salto acrescenta ao fim, então
 * a primeira entrada é a única que o cliente escolhe sozinho. Usando ela, um
 * atacante trocava o cabeçalho a cada requisição, nunca repetia a mesma
 * chave e jamais era bloqueado — e a senha do painel é o único portão da
 * API de dados. A última entrada é a que o proxy imediatamente à frente
 * escreveu, e essa o cliente não forja.
 *
 * `x-vercel-forwarded-for` vem antes quando existe: a plataforma o preenche
 * sozinha e ignora o que o cliente mandou.
 */
function origem(request: NextRequest): string {
  const cadeia = request.headers.get("x-forwarded-for");
  const ultimo = cadeia?.split(",").at(-1)?.trim();
  return (
    request.headers.get("x-vercel-forwarded-for")?.trim() ||
    ultimo ||
    request.headers.get("x-real-ip")?.trim() ||
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
