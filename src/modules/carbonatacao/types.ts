// src/modules/carbonatacao/types.ts
// TODO: definir interfaces específicas do módulo carbonatacao

export interface carbonatacaoEnsaio {
  id: string
  obra_id: string
  data_ensaio: string
  elemento_estrutural: string
  responsavel_id: string
  observacoes?: string
  created_at: string
}
