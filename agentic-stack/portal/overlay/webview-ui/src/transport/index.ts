import { FactoryTransport } from '../factory/FactoryTransport.js';
import type { MessageTransport } from './types.js';

// Portal da AI Games Factory: o escritorio le os eventos da fabrica (Supabase), nao ha servidor do Pixel Agents.
export const transport: MessageTransport = new FactoryTransport();
export type { MessageTransport } from './types.js';
