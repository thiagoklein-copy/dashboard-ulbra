"use client";

import {
  CreativeExpanded,
  CreativeThumbnail,
} from "@/components/creative-preview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMetric } from "@/lib/format";
import type { AggregatedRow, AggregationLevel } from "@/lib/types";

interface CreativeModalProps {
  row: AggregatedRow | null;
  level: AggregationLevel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreativeModal({
  row,
  level,
  open,
  onOpenChange,
}: CreativeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {row && (
          <>
            <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
              <div className="flex items-start gap-3">
                <CreativeThumbnail
                  imageUrl={row.image_url}
                  videoId={row.video_id}
                  alt={row.name}
                  className="size-10"
                />
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="truncate text-base">
                    {row.name}
                  </DialogTitle>
                  <DialogDescription className="line-clamp-2">
                    {[row.campaign_name, row.adset_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </DialogDescription>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                    <span>
                      Invest.{" "}
                      <strong className="text-foreground">
                        {formatMetric(row.spend, "currency")}
                      </strong>
                    </span>
                    <span>
                      Resultados{" "}
                      <strong className="text-foreground">
                        {formatMetric(row.results, "number")}
                      </strong>
                    </span>
                    <span>
                      Custo/Result.{" "}
                      <strong className="text-foreground">
                        {row.results > 0
                          ? formatMetric(row.cost_per_result, "currency")
                          : "—"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <CreativeExpanded
                row={row}
                showAggregateHint={level !== "ad"}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
