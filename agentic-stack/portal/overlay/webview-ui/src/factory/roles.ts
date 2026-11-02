// Nome de cada papel como aparece no portal. O papel tecnico (chave do factory.yaml) continua sendo o do arquivo do agente.
export const ROLE_LABEL: Record<string, string> = {
  principal: 'PM',
  po: 'PO',
  'tech-lead': 'Tech Lead',
  dev: 'Dev',
  qa: 'QA',
  designer: 'Designer',
  suporte: 'Suporte',
  release: 'Release',
  'game-designer': 'Game Designer',
};
// Sigla curta sobre a cabeca de cada agente (a cor ja diz que e agente).
const ROLE_SIGLA: Record<string, string> = {
  principal: 'PM',
  po: 'PO',
  'tech-lead': 'CTO',
  dev: 'DEV',
  qa: 'QA',
  designer: 'DSG',
  suporte: 'SUP',
  release: 'REL',
  'game-designer': 'GD',
};
// Sobrescritas por squad (slug do jogo): sigla e rotulo diferentes do padrao.
const OVERRIDES: Record<string, Record<string, { sigla: string; label: string }>> = {
  'agentic-stack': {
    principal: { sigla: 'CTO', label: 'CTO' },
    'tech-lead': { sigla: 'TL', label: 'Tech Lead' },
  },
  'marketing-squad': {
    principal: { sigla: 'CMO', label: 'CMO' },
  },
};
export const roleSigla = (role: string, game?: string): string =>
  (game && OVERRIDES[game]?.[role]?.sigla) || ROLE_SIGLA[role] || role.slice(0, 4).toUpperCase();
export const roleLabel = (role: string, game?: string): string =>
  (game && OVERRIDES[game]?.[role]?.label) || ROLE_LABEL[role] || role;
// Desfaz o rotulo para a chave tecnica do papel; com o squad, as sobrescritas dele valem primeiro.
export const roleFromLabel = (label: string, game?: string): string => {
  const ov = game ? OVERRIDES[game] : undefined;
  const dele = ov && Object.entries(ov).find(([, v]) => v.label === label)?.[0];
  if (dele) return dele;
  // Rotulo padrao so vale se o squad nao o trocou por outro (ex.: "Tech Lead" no padrao, mas no agentic-stack tambem e tech-lead).
  const padrao = Object.entries(ROLE_LABEL).find(([k, v]) => v === label && !(ov && ov[k] && ov[k].label !== label))?.[0];
  return padrao ?? label;
};
