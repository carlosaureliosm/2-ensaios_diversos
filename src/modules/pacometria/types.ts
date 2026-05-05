// src/modules/pacometria/types.ts
// TODO: definir interfaces específicas do módulo pacometria

export interface pacometriaEnsaio {
  id: string
  obra_id: string
  data_ensaio: string
  elemento_estrutural: string
  responsavel_id: string
  observacoes?: string
  created_at: string
}
