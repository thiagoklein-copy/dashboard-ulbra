/** Links para abrir o anúncio no Meta / o vídeo no Facebook. */

export function adsManagerUrl(adId: string | null | undefined): string | null {
  if (!adId) return null;
  const act = process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID?.replace(/^act_/i, "") ?? "";
  const qs = new URLSearchParams({ selected_ad_ids: adId });
  if (act) qs.set("act", act);
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?${qs.toString()}`;
}

export function facebookWatchUrl(videoId: string): string {
  return `https://www.facebook.com/watch/?v=${encodeURIComponent(videoId)}`;
}

/**
 * Embed do plugin do Facebook.
 * Feed ads costumam ser 4:5 — 9:16 deixava faixa branca em vídeos mais largos.
 */
export function facebookVideoEmbedUrl(
  videoId: string,
  size: { width?: number; height?: number } = {}
): string {
  const width = size.width ?? 480;
  const height = size.height ?? 600;
  const href = encodeURIComponent(facebookWatchUrl(videoId));
  return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=${width}&height=${height}`;
}

export function resolveAdPreviewUrl(
  previewShareableLink: string | null | undefined,
  adId: string | null | undefined
): string | null {
  const preview = previewShareableLink?.trim();
  if (preview) return preview;
  return adsManagerUrl(adId);
}
