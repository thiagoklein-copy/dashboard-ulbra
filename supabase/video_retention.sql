-- Retenção + mídia de vídeo para o dashboard ULBRA
-- O n8n pode gravar isso em ad_insights / ad_creatives / view.

-- Retenção (quartis Meta)
alter table ad_insights
  add column if not exists video_plays integer,
  add column if not exists video_avg_watch_time_sec numeric,
  add column if not exists video_duration_sec numeric,
  add column if not exists video_p25 numeric,
  add column if not exists video_p50 numeric,
  add column if not exists video_p75 numeric,
  add column if not exists video_p95 numeric,
  add column if not exists video_p100 numeric;

-- Mídia + transcrição (em ad_creatives ou na view)
alter table ad_creatives
  add column if not exists video_storage_url text,
  add column if not exists video_transcript text,
  add column if not exists preview_shareable_link text;

-- Campos sugeridos na view v_ads_performance:
-- video_storage_url, video_transcript, preview_shareable_link,
-- video_plays, video_avg_watch_time_sec, video_duration_sec,
-- video_p25, video_p50, video_p75, video_p95, video_p100

-- Insights Meta (Marketing API) tipicamente usados no n8n:
-- video_play_actions
-- video_avg_time_watched_actions
-- video_p25_watched_actions … video_p100_watched_actions
-- (+ arquivo de vídeo no storage + job de transcrição)
