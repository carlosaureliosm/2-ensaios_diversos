// src/modules/potencial-corrosao/types.ts
// TODO: definir interfaces específicas do módulo potencial-corrosao

export interface PotencialCorrosaoEnsaio {
  id: string
  obra_id: string
  data_ensaio: string
  elemento_estrutural: string
  responsavel_id: string
  observacoes?: string
  created_at: string
}
