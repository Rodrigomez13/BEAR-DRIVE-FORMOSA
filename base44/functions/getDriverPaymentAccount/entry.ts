import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api } from '../../shared/domain.ts';
import { publicPaymentAccount } from '../../shared/paymentStatus.ts';

export default req => api(req, createClientFromRequest, async (client, user) => {
  const accounts = await client.asServiceRole.entities.PaymentAccount.filter({ driver_id: user.id });
  return { account: publicPaymentAccount(accounts.find(a => a.access_token) || accounts[0]) };
});
