-- Função que insere os horários padrão para um novo estabelecimento
CREATE OR REPLACE FUNCTION public.initialize_opening_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.horarios_funcionamento (estabelecimento_id, dia_semana, hora_inicio, hora_fim, ativo)
  VALUES 
    (NEW.id, 0, '08:00', '18:00', false), -- Domingo
    (NEW.id, 1, '08:00', '18:00', true),  -- Segunda
    (NEW.id, 2, '08:00', '18:00', true),  -- Terça
    (NEW.id, 3, '08:00', '18:00', true),  -- Quarta
    (NEW.id, 4, '08:00', '18:00', true),  -- Quinta
    (NEW.id, 5, '08:00', '18:00', true),  -- Sexta
    (NEW.id, 6, '08:00', '18:00', true);  -- Sábado
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho que dispara automaticamente após a criação de um estabelecimento
DROP TRIGGER IF EXISTS on_establishment_created ON public.estabelecimentos;
CREATE TRIGGER on_establishment_created
  AFTER INSERT ON public.estabelecimentos
  FOR EACH ROW EXECUTE FUNCTION public.initialize_opening_hours();

-- Garantir que o estabelecimento atual também tenha todos os dias (caso falte algum)
INSERT INTO public.horarios_funcionamento (estabelecimento_id, dia_semana, hora_inicio, hora_fim, ativo)
SELECT e.id, d.dia, '08:00', '18:00', (d.dia != 0)
FROM public.estabelecimentos e
CROSS JOIN (SELECT unnest(ARRAY[0,1,2,3,4,5,6]) as dia) d
LEFT JOIN public.horarios_funcionamento h ON h.estabelecimento_id = e.id AND h.dia_semana = d.dia
WHERE h.id IS NULL;
