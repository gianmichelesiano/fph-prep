// FPH Offizin exam areas with design-system color tokens
// Source of truth: public.areas table in Supabase
// This static map is used as fallback until the DB is loaded
export const AREAS = {
  1:  { name: 'Validazione ricette',      color: 'bg-primary/10 text-primary',                              questions: 7  },
  2:  { name: 'Fitoterapia',              color: 'bg-tertiary/10 text-tertiary',                             questions: 3  },
  3:  { name: 'Medicina complementare',   color: 'bg-secondary/10 text-secondary',                           questions: 3  },
  4:  { name: 'Farmacia Clinica',         color: 'bg-primary-container/20 text-primary-container',           questions: 50 },
  5:  { name: 'Anamnesi e terapia',       color: 'bg-primary/10 text-primary',                               questions: 10 },
  6:  { name: 'Preparazione medicinali',  color: 'bg-tertiary/15 text-tertiary',                             questions: 7  },
  7:  { name: 'Risultati di laboratorio', color: 'bg-secondary-container text-on-secondary-container',       questions: 7  },
  8:  { name: "Situazioni d'emergenza",   color: 'bg-error-container text-error',                            questions: 7  },
  9:  { name: 'Vaccinazioni e prelievi',  color: 'bg-primary-fixed/30 text-on-primary-fixed',                questions: 7  },
  10: { name: 'Altro',                    color: 'bg-surface-container-high text-on-surface-variant',        questions: 3  },
}

// area_config fissa per simulazioni d'esame FPH
export const EXAM_AREA_CONFIG = { 1:7, 2:3, 3:3, 4:50, 5:10, 6:7, 7:3, 8:7, 9:7, 10:3 }
export const EXAM_TIMER = 210
export const EXAM_TOTAL = 100
