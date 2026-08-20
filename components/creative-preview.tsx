"use client";

import { useState } from "react";
import { ExternalLink, ImageIcon, Play } from "lucide-react";
import { VideoDesempenhoPanel } from "@/components/video-desempenho-panel";
import { VideoRetentionChart } from "@/components/video-retention-chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  facebookVideoEmbedUrl,
  facebookWatchUrl,
  resolveAdPreviewUrl,
} from "@/lib/ad-links";
import type { AggregatedRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Imagens da Meta recusam hotlink do navegador — passamos pelo proxy. */
export function proxyImagem(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https:\/\/([^/]*\.)?(facebook\.com|fbcdn\.net)\//.test(url)) return url;
  return `/api/img?u=${encodeURIComponent(url)}`;
}

interface CreativeThumbnailProps {
  imageUrl: string | null;
  videoId: string | null;
  alt: string;
  className?: string;
}

export function CreativeThumbnail({
  imageUrl,
  videoId,
  alt,
  className,
}: CreativeThumbnailProps) {
  const isVideo = Boolean(videoId);

  return (
    <div
      className={cn(
        "relative size-12 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border",
        className
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImagem(imageUrl) ?? imageUrl}
          alt={alt}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageIcon className="size-4" />
        </div>
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <div className="flex size-5 items-center justify-center rounded-full bg-white/90">
            <Play className="size-2.5 fill-black text-black" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Player do Meta: poster encaixado (sem corte); embed só sob demanda em 4:5. */
function FacebookVideoPreview({
  videoId,
  name,
  posterUrl,
}: {
  videoId: string;
  name: string;
  posterUrl: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const poster = proxyImagem(posterUrl);

  if (playing) {
    return (
      <div className="bg-black">
        <iframe
          title={`Vídeo do anúncio ${name}`}
          src={facebookVideoEmbedUrl(videoId)}
          className="mx-auto block aspect-[4/5] w-full max-w-[480px] border-0 bg-black"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="text-xs text-white/70 hover:text-white"
          >
            Voltar ao criativo
          </button>
          <a
            href={facebookWatchUrl(videoId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
          >
            Abrir no Facebook
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    );
  }

  if (poster) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="group relative block w-full cursor-pointer text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt={name}
          className="block h-auto max-h-[min(75vh,860px)] w-full object-contain"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/95 shadow-lg">
            <Play className="size-6 fill-black text-black" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-muted px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        Preview do vídeo indisponível neste painel
      </p>
      <a
        href={facebookWatchUrl(videoId)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
      >
        Assistir no Facebook
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

interface CreativeExpandedProps {
  row: AggregatedRow;
  showAggregateHint?: boolean;
}

export function CreativeExpanded({
  row,
  showAggregateHint,
}: CreativeExpandedProps) {
  const videoSrc = row.video_storage_url?.trim() || null;
  const hasTranscript = Boolean(row.video_transcript?.trim());
  const showTranscriptPending = Boolean(row.video_id) && !hasTranscript;
  const adPreviewUrl = resolveAdPreviewUrl(
    row.preview_shareable_link,
    row.ad_id
  );
  const videoWatchUrl = row.video_id ? facebookWatchUrl(row.video_id) : null;
  const landingUrl = row.link_url?.trim() || null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Mídia — borda colada no criativo */}
        <div className="overflow-hidden rounded-xl border bg-black">
          {videoSrc ? (
            <video
              key={videoSrc}
              className="block h-auto max-h-[min(75vh,860px)] w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              poster={proxyImagem(row.image_url) ?? undefined}
              src={videoSrc}
            />
          ) : row.video_id ? (
            <FacebookVideoPreview
              videoId={row.video_id}
              name={row.name}
              posterUrl={row.image_url}
            />
          ) : row.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyImagem(row.image_url) ?? row.image_url}
              alt={row.name}
              className="block h-auto max-h-[min(75vh,860px)] w-full object-contain"
            />
          ) : (
            <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
              <ImageIcon className="size-8 opacity-50" />
              <p className="text-xs">Sem mídia disponível</p>
            </div>
          )}
        </div>

        {/* Texto — direita (embaixo no mobile) */}
        <div className="flex min-h-0 flex-col gap-4">
          <h3 className="text-lg font-semibold leading-snug tracking-tight">
            {row.headline?.trim() || row.name}
          </h3>

          {(hasTranscript || showTranscriptPending) && (
            <div className="min-h-0 space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Transcrição do vídeo
              </p>
              {hasTranscript ? (
                <ScrollArea className="h-48 rounded-lg border bg-muted/30">
                  <div className="whitespace-pre-wrap p-3 text-sm leading-relaxed">
                    {row.video_transcript}
                  </div>
                </ScrollArea>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground italic">
                  Transcrição ainda não processada
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 border-t pt-3">
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Texto do post
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {row.primary_text?.trim() || "—"}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                CTA
              </p>
              <p className="text-sm font-medium">
                {formatCta(row.call_to_action) || "—"}
              </p>
            </div>

            {adPreviewUrl && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ver anúncio
                </p>
                <a
                  href={adPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                >
                  {row.preview_shareable_link
                    ? "Abrir preview do anúncio no Meta"
                    : "Abrir no Gerenciador de Anúncios"}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}

            {videoWatchUrl && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Vídeo
                </p>
                <a
                  href={videoWatchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                >
                  Abrir vídeo no Facebook
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}

            {landingUrl && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Página de destino
                </p>
                <a
                  href={landingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 break-all text-sm text-blue-600 hover:underline"
                >
                  {landingUrl}
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </div>
            )}
          </div>

          {showAggregateHint && (
            <p className="text-xs text-muted-foreground">
              Agrega {row.ad_count} anúncio(s). Mude o nível para
              &quot;Anúncios&quot; para ver cada criativo.
            </p>
          )}
        </div>
      </div>

      {row.video_desempenho?.curva.length ? (
        <VideoDesempenhoPanel desempenho={row.video_desempenho} />
      ) : null}

      {row.video_retention && (
        <VideoRetentionChart retention={row.video_retention} />
      )}
    </div>
  );
}

function formatCta(cta: string | null | undefined): string | null {
  if (!cta) return null;
  return cta.replaceAll("_", " ");
}
