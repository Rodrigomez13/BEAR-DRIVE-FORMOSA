import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, requireNoDebt } from '../../shared/domain.ts';
import { quoteRoute } from '../../shared/quotes.ts';
export default req => api(req, createClientFromRequest, async (client, user, body) => {
  await requireNoDebt(client, user.id);
  return { quote: await quoteRoute(client, user.id, body) };
});
