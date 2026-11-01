import { createClient } from '@supabase/supabase-js';

import { SB_KEY, SB_URL } from './config.js';

export const sb = createClient(SB_URL, SB_KEY);
