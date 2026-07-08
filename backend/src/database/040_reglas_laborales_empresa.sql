CREATE TABLE IF NOT EXISTS reglas_laborales_empresa (
  empresa_id UUID PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  jornada_diaria_minutos INTEGER NOT NULL DEFAULT 480,
  jornada_semanal_minutos INTEGER NOT NULL DEFAULT 2400,
  base_calculo_mensual_horas NUMERIC(8,2) NOT NULL DEFAULT 240,
  dias_base_mes NUMERIC(8,2) NOT NULL DEFAULT 30,
  tolerancia_atraso_minutos INTEGER NOT NULL DEFAULT 0,
  almuerzo_minutos INTEGER NOT NULL DEFAULT 60,
  almuerzo_inicio TIME NOT NULL DEFAULT '12:00',
  almuerzo_fin TIME NOT NULL DEFAULT '15:00',
  descontar_almuerzo_automatico BOOLEAN NOT NULL DEFAULT TRUE,
  hora_inicio_nocturna TIME NOT NULL DEFAULT '19:00',
  hora_fin_nocturna TIME NOT NULL DEFAULT '06:00',
  recargo_suplementaria NUMERIC(5,2) NOT NULL DEFAULT 1.50,
  recargo_extraordinaria NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  recargo_nocturna NUMERIC(5,2) NOT NULL DEFAULT 1.25,
  recargo_feriado NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  redondeo_minutos INTEGER NOT NULL DEFAULT 1,
  ausencia_permiso_pagado BOOLEAN NOT NULL DEFAULT TRUE,
  ausencia_incapacidad_pagada BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reglas_laborales_minutos_check CHECK (
    jornada_diaria_minutos > 0
    AND jornada_semanal_minutos > 0
    AND tolerancia_atraso_minutos >= 0
    AND almuerzo_minutos >= 0
    AND redondeo_minutos > 0
  ),
  CONSTRAINT reglas_laborales_bases_check CHECK (
    base_calculo_mensual_horas > 0
    AND dias_base_mes > 0
    AND recargo_suplementaria >= 1
    AND recargo_extraordinaria >= 1
    AND recargo_nocturna >= 1
    AND recargo_feriado >= 1
  )
);

