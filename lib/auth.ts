export const AUTH_COOKIE = "ulbra_dashboard_auth";

/** 30 dias, igual ao maxAge do cookie. */
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Segredo de assinatura.
 *
 * Usa AUTH_SECRET quando definido. Sem ele, deriva da senha do painel —
 * assim o token de todo mundo é invalidado quando a senha muda, que é o
 * comportamento desejado.
 */
function segredo(): string {
  const s = process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD;
  if (!s) throw new Error("AUTH_SECRET ou DASHBOARD_PASSWORD não configurado");
  return s;
}

/** Comparação em tempo constante: `===` vaza o tamanho do prefixo correto. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isValidPassword(password: string): boolean {
  const esperada = process.env.DASHBOARD_PASSWORD;
  if (!esperada) return false;
  return iguaisEmTempoConstante(password, esperada);
}

/**
 * Web Crypto, e não `node:crypto`.
 *
 * O portão de autenticação (`proxy.ts`) pode ser distribuído para CDN e
 * rodar fora do runtime principal, onde `node:crypto` não existe. A API
 * global funciona nos dois lugares.
 */
async function assinar(mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(mensagem)
  );
  return Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gera o valor do cookie: expiração + assinatura.
 *
 * Antes o valor era a constante "1", então bastava enviar
 * `ulbra_dashboard_auth=1` para entrar sem senha nenhuma.
 */
export async function criarToken(): Promise<string> {
  const expira = Date.now() + VALIDADE_MS;
  return `${expira}.${await assinar(String(expira))}`;
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiraStr, assinatura] = token.split(".");
  if (!expiraStr || !assinatura) return false;

  const expira = Number(expiraStr);
  if (!Number.isFinite(expira) || Date.now() > expira) return false;

  try {
    return iguaisEmTempoConstante(assinatura, await assinar(expiraStr));
  } catch {
    return false;
  }
}

/**
 * Limite de tentativas de login por origem.
 *
 * Sem isso a senha do painel cai por força bruta: nao havia contencao
 * nenhuma, e a API de dados fica atras dela.
 */
const TENTATIVAS_MAX = 8;
const JANELA_MS = 10 * 60 * 1000;
const tentativas = new Map<string, { n: number; ate: number }>();

/**
 * O mapa só encolhia quando alguém consultava a mesma origem de novo.
 *
 * `X-Forwarded-For` é um cabeçalho que o cliente escolhe: variá-lo a cada
 * tentativa criava uma entrada nova que nunca mais era visitada, e o mapa
 * crescia sem teto até derrubar o processo. Agora toda gravação varre o que
 * já venceu, e um teto duro impede que uma rajada estoure a memória antes
 * da janela expirar.
 */
const ORIGENS_MAX = 10_000;

/*
  Este contador vive na memória do processo.

  Em deploy serverless ou com mais de uma instância, cada uma tem o seu, e
  o limite efetivo vira 8 × número de instâncias. Aceitável para um painel
  interno com uma senha só, e o custo de acertar é uma dependência externa
  (Redis/Upstash) para guardar oito inteiros. Se o painel abrir para fora,
  ou se o número de instâncias crescer, é o primeiro lugar a mexer.
*/

function podar(agora: number): void {
  for (const [chave, v] of tentativas) {
    if (agora > v.ate) tentativas.delete(chave);
  }
  // Se depois da poda ainda estourou, a janela inteira é lixo de rajada:
  // limpar tudo perde no máximo alguns contadores legítimos, e o bloqueio
  // volta a valer na tentativa seguinte.
  if (tentativas.size > ORIGENS_MAX) tentativas.clear();
}

export function registrarFalha(origem: string): void {
  const agora = Date.now();
  const atual = tentativas.get(origem);
  if (!atual || agora > atual.ate) {
    podar(agora);
    tentativas.set(origem, { n: 1, ate: agora + JANELA_MS });
    return;
  }
  atual.n += 1;
}

export function bloqueado(origem: string): boolean {
  const atual = tentativas.get(origem);
  if (!atual) return false;
  if (Date.now() > atual.ate) {
    tentativas.delete(origem);
    return false;
  }
  return atual.n >= TENTATIVAS_MAX;
}

export function limparTentativas(origem: string): void {
  tentativas.delete(origem);
}
