// Busca uma URL assinada de curta duração (1h) para a assinatura do usuário, sob demanda.
// Nunca persistir o resultado — ela expira; chamar de novo quando precisar exibir a prévia.
// `temAssinatura` evita a chamada de rede quando já se sabe que o usuário não tem assinatura
// cadastrada (ex: `assinatura_path` ausente no próprio metadata, ou `has_assinatura` da listagem).
export async function buscarUrlAssinatura(userId: string, temAssinatura?: unknown): Promise<string> {
  if (!temAssinatura) return '';
  try {
    const res = await fetch(`/api/users/${userId}/assinatura`);
    if (!res.ok) return '';
    const json = await res.json();
    return json.assinatura_url ?? '';
  } catch {
    return '';
  }
}
