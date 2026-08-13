import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy de imagem de criativo.
 *
 * As URLs do Meta (facebook.com/ads/image e scontent-*.fbcdn.net) respondem
 * bem servidor-a-servidor, mas o navegador manda headers extras — Referer,
 * Sec-Fetch-* — que fazem a Meta recusar o hotlink. Buscar aqui e repassar
 * elimina o problema, e de quebra permite cachear.
 */
const HOSTS_PERMITIDOS = [/(^|\.)facebook\.com$/, /(^|\.)fbcdn\.net$/];

export async function GET(request: NextRequest) {
  const alvo = request.nextUrl.searchParams.get("u");
  if (!alvo) {
    return NextResponse.json({ error: "Parâmetro 'u' ausente" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(alvo);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  // Sem essa checagem o endpoint viraria um proxy aberto.
  if (
    url.protocol !== "https:" ||
    !HOSTS_PERMITIDOS.some((re) => re.test(url.hostname))
  ) {
    return NextResponse.json({ error: "Host não permitido" }, { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ulbra-dashboard)" },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Origem respondeu ${upstream.status}` },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar imagem" }, { status: 502 });
  }
}
