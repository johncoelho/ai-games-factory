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
export const roleSigla = (role: string): string => ROLE_SIGLA[role] ?? role.slice(0, 4).toUpperCase();
export const roleLabel =(role: string): string => ROLE_LABEL[role] ?? role;
export const roleFromLabel = (label: string): string =>
  Object.entries(ROLE_LABEL).find(([, v]) => v === label)?.[0] ?? label;
