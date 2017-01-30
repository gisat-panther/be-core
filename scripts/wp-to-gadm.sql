-- replace ____autable____ with the table name (3x)

-- 1 ALTER TABLE - add columns
DO $$
  BEGIN
    BEGIN
      ALTER TABLE ____autable____ ADD COLUMN wpstat_pop10 double precision;
    EXCEPTION
      WHEN duplicate_column THEN RAISE WARNING 'column gufstat_uf already exists.';
    END;
  END;
$$;


-- 2 UPDATE - add data
UPDATE ____autable____ au
  SET
    wpstat_pop10 = CASE
      WHEN wpStats.popsum <> 0 THEN wpStats.popsum
      ELSE 0
    END
  FROM (
    SELECT
      wsau.the_geom AS the_geom,
      ROUND(SUM((ST_SummaryStats(ST_Clip(wswp.rast, wsau.the_geom))).sum)::NUMERIC,0) AS popsum
      FROM ____autable____ wsau
        INNER JOIN worldpop wswp ON ST_Intersects(wswp.rast, wsau.the_geom)
      WHERE ST_Intersects(rast, wsau.the_geom)
      GROUP BY wsau.the_geom
  ) AS wpStats
  WHERE au.the_geom = wpStats.the_geom;

