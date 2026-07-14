UPDATE tasks SET priority = CASE priority
  WHEN 'low' THEN 'default'
  WHEN 'medium' THEN 'amber'
  WHEN 'high' THEN 'red'
  ELSE 'default'
END;
