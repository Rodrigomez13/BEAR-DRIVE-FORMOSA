import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, debtStatus } from '../../shared/domain.ts';
export default req => api(req,createClientFromRequest,async (client,user) => debtStatus(client,user.id));
