-- 010_backfill_blocks.sql
-- Backfill: wrap existing active plans in a training block

INSERT INTO public.training_blocks (plan_id, block_number, block_type, block_label, week_count, start_date, end_date, status, generation_context)
SELECT
  tp.id AS plan_id,
  1 AS block_number,
  COALESCE(
    (tp.plan_config->>'periodization_phase'),
    'accumulation'
  ) AS block_type,
  COALESCE(
    INITCAP(tp.plan_config->>'periodization_phase') || ' Block',
    'Accumulation Block'
  ) AS block_label,
  GREATEST(1, CEIL(
    (MAX(pw.date) - MIN(pw.date) + 1)::numeric / 7
  ))::integer AS week_count,
  MIN(pw.date) AS start_date,
  MAX(pw.date) AS end_date,
  'active' AS status,
  jsonb_build_object('source', 'backfill') AS generation_context
FROM public.training_plans tp
JOIN public.planned_workouts pw ON pw.plan_id = tp.id
WHERE tp.status = 'active'
GROUP BY tp.id;

-- Set block_id on existing planned_workouts
UPDATE public.planned_workouts pw
SET block_id = tb.id
FROM public.training_blocks tb
WHERE tb.plan_id = pw.plan_id
  AND tb.status = 'active'
  AND tb.generation_context->>'source' = 'backfill'
  AND pw.block_id IS NULL;
