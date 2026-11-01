// Chave publicavel (anon): feita para ficar no navegador. O acesso aos dados e controlado por login + RLS no banco.
// Formato classico (JWT) de proposito: o cliente do Supabase fixado aqui e o Realtime nao entendem as chaves sb_publishable_.
export const SB_URL = 'https://lwaoxnjajxljxusxujku.supabase.co';
export const SB_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3YW94bmphanhsanh1c3h1amt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM0MDUsImV4cCI6MjA5NjE0OTQwNX0.usK7WkdJaGmXi5rk3tPoTKd4yH5EWCbcxsHaR3WOcEk';

// Squads que o escritorio mostra. O factory.yaml de cada um define nome do squad, equipe e etapas.
// naval-battle: no repo do jogo (publico). agentic-stack: o repo e privado, entao o yaml publico fica no repo do site (squads/).
export const SQUADS: { slug: string; yaml: string }[] = [
  { slug: 'naval-battle', yaml: 'https://raw.githubusercontent.com/johncoelho/naval-battle/main/factory.yaml' },
  { slug: 'agentic-stack', yaml: 'https://raw.githubusercontent.com/johncoelho/ai-games-factory/main/squads/agentic-stack.yaml' },
  { slug: 'monopoly', yaml: 'https://raw.githubusercontent.com/johncoelho/ai-games-factory/main/squads/monopoly.yaml' },
  { slug: 'marketing', yaml: 'https://raw.githubusercontent.com/johncoelho/ai-games-factory/main/squads/marketing.yaml' },
];
export const GAMES = SQUADS.map((s) => s.slug);
