"use client";

import { ImageIcon, Play } from "lucide-react";
import { VideoDesempenhoPanel } from "@/components/video-desempenho-panel";
import { VideoRetentionChart } from "@/components/video-retention-chart";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Mídia — esquerda (topo no mobile) */}
        <div className="overflow-hidden rounded-xl border bg-muted">
          <div className="relative aspect-[4/5] w-full bg-black/5">
            {videoSrc ? (
              <video
                key={videoSrc}
                className="size-full bg-black object-contain"
                controls
                playsInline
                preload="metadata"
                poster={proxyImagem(row.image_url) ?? undefined}
                src={videoSrc}
              />
            ) : row.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxyImagem(row.image_url) ?? row.image_url}
                alt={row.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="size-8 opacity-50" />
                <p className="text-xs">Sem mídia disponível</p>
              </div>
            )}

            {!videoSrc && row.video_id && row.image_url && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/90 shadow">
                  <Play className="size-5 fill-black text-black" />
                </div>
              </div>
            )}
          </div>
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

            {row.link_url && (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Link
                </p>
                <a
                  href={row.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-blue-600 hover:underline"
                >
                  {row.link_url}
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
