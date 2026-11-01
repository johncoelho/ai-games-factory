// Quem esta vendo o escritorio: o CEO (login do dono) ou um visitante (sem login, so ve e anda).
export const OWNER_EMAIL = 'joncqs@gmail.com';

export const me = {
  role: 'visitor' as 'ceo' | 'visitor',
  name: '',
  palette: 0,
};

export const MY_ID = 90000;
export const isOwner = (): boolean => me.role === 'ceo';
