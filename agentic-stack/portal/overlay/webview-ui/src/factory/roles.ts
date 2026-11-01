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
export const roleLabel = (role: string): string => ROLE_LABEL[role] ?? role;
export const roleFromLabel = (label: string): string =>
  Object.entries(ROLE_LABEL).find(([, v]) => v === label)?.[0] ?? label;
