import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, tokenValido } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

/**
 * Portão de autenticação de tudo que não é `/login`.
 *
 * Chamava-se `middleware.ts` até o Next 16 depreciar a convenção em favor
 * de `proxy`. Só o nome do arquivo e o do export mudaram — o comportamento
 * é o mesmo, e o `next build` avisava a cada compilação.
 *
 * Uma consequência do nome novo importa aqui: proxy pode ser distribuído
 * para CDN e roda separado do render, então não dá para contar com módulo
 * ou global compartilhado. Já era o caso — o contador de tentativas de
 * login vive na rota `/api/auth/login`, não neste arquivo.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // O valor precisa ser um token assinado: quando era a constante "1",
  // bastava enviar o cookie para entrar sem senha.
  if (await tokenValido(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
