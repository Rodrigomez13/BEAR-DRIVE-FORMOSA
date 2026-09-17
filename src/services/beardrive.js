import { base44 } from '@/api/base44Client';
import { createBase44Services } from './base44-adapter';

// Base44 remains the only live authority until a verified domain cutover.
// Do not select an authority from a client-controlled query parameter.
export const beardrive = createBase44Services(base44);
