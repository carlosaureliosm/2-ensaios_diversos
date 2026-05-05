// src/modules/esclerometria/types.ts
// TODO: definir interfaces específicas do módulo esclerometria

export interface esclerometriaEnsaio {
  id: string
  obra_id: string
  data_ensaio: string
  elemento_estrutural: string
  responsavel_id: string
  observacoes?: string
  created_at: string
}
