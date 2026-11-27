import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addErrorHandler, createApp } from '../server/app.js';
import { closeDatabase, getDb, initDatabase } from '../server/database.js';
import { setRazorpayGatewayAdapter, type RazorpayGatewayPayment } from '../server/services/paymentService.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentiq-payments-'));
let app: Express;
let recruiterAgent: ReturnType<typeof request.agent>;
let candidateAgent: ReturnType<typeof request.agent>;

const TEST_KEY_ID = 'rzp_test_talentiq_12345';
const TEST_KEY_SECRET = 'test_secret_abcdef123456';
const TEST_WEBHOOK_SECRET = 'whsec_test_987654321';

let mockPaymentStatus: RazorpayGatewayPayment['status'] = 'captured';
let mockPaymentMethod = 'upi';
let mockPaymentAmountOverride: number | null = null;
let orderCounter = 100;

function signCheckout(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', TEST_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

function signWebhook(body: string): string {
  return crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(body).digest('hex');
}

beforeAll(async () => {
  initDatabase({ dbPath: path.join(tempDir, 'payments.db'), seed: false });
  app = createApp();
  addErrorHandler(app);
  recruiterAgent = request.agent(app);
  candidateAgent = request.agent(app);

  await recruiterAgent
    .post('/api/auth/register')
    .send({ email: 'billing.recruiter@india.in', password: 'Password@123', role: 'recruiter', fullName: 'Siddharth Joshi' })
    .expect(201);

  await candidateAgent
    .post('/api/auth/register')
    .send({ email: 'billing.candidate@india.in', password: 'Password@123', role: 'candidate', fullName: 'Pooja Nair' })
    .expect(201);
});

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  mockPaymentStatus = 'captured';
  mockPaymentMethod = 'upi';
  mockPaymentAmountOverride = null;

  setRazorpayGatewayAdapter({
    async createOrder({ amountPaise, currency, receipt }) {
      orderCounter += 1;
      return {
        id: `order_test_${orderCounter}`,
        amount: amountPaise,
        currency,
        receipt,
        status: 'created',
      };
    },
    async fetchPayment({ paymentId }) {
      const row = getDb().prepare('SELECT gateway_order_id, amount_paise, currency FROM payment_orders ORDER BY created_at DESC LIMIT 1').get() as {
        gateway_order_id: string;
        amount_paise: number;
        currency: string;
      };
      return {
        id: paymentId,
        order_id: row.gateway_order_id,
        amount: mockPaymentAmountOverride ?? row.amount_paise,
        currency: row.currency,
        status: mockPaymentStatus,
        method: mockPaymentMethod,
      };
    },
    async fetchOrderPayments({ gatewayOrderId }) {
      const row = getDb().prepare('SELECT amount_paise, currency FROM payment_orders WHERE gateway_order_id = ?').get(gatewayOrderId) as {
        amount_paise: number;
        currency: string;
      };
      return [
        {
          id: `pay_sync_${gatewayOrderId}`,
          order_id: gatewayOrderId,
          amount: row.amount_paise,
          currency: row.currency,
          status: mockPaymentStatus,
          method: mockPaymentMethod,
        },
      ];
    },
  });
});

afterAll(() => {
  setRazorpayGatewayAdapter(undefined);
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Razorpay Payment Security & Verification', () => {
  it('blocks order creation when Razorpay credentials are missing and never activates subscriptions', async () => {
    process.env.RAZORPAY_KEY_ID = '';
    process.env.RAZORPAY_KEY_SECRET = '';
    const plansRes = await request(app).get('/api/payments/plans').expect(200);
    expect(plansRes.body.gateway.configured).toBe(false);

    const res = await recruiterAgent
      .post('/api/payments/orders')
      .send({ planId: 'plan-recruiter-starter' })
      .expect(503);
    expect(res.body.error.code).toBe('PAYMENT_NOT_CONFIGURED');

    const sub = await recruiterAgent.get('/api/payments/subscription').expect(200);
    expect(sub.body.subscription).toBeNull();
  });

  it('rejects candidates from recruiter payment endpoints, invalid plan IDs, and uses server pricing only', async () => {
    await candidateAgent.post('/api/payments/orders').send({ planId: 'plan-recruiter-starter' }).expect(403);
    await recruiterAgent.post('/api/payments/orders').send({ planId: 'invalid-plan-id' }).expect(404);

    // Even if client attempts to pass a tampered amount, server computes amount from DB plan (99900 paise)
    const created = await recruiterAgent
      .post('/api/payments/orders')
      .send({ planId: 'plan-recruiter-starter', amountPaise: 100, amount: 1 })
      .expect(201);
    expect(created.body.order.amountPaise).toBe(99900);
    expect(created.body.checkout.amountPaise).toBe(99900);
    expect(created.body.checkout.upiSupported).toBe(true);
    expect(created.body.checkout.mode).toBe('test');
    // Secret key must never leak
    expect(JSON.stringify(created.body)).not.toContain(TEST_KEY_SECRET);
  });

  it('rejects invalid signatures and never activates entitlements for unverified or pending UPI payments', async () => {
    const created = await recruiterAgent.post('/api/payments/orders').send({ planId: 'plan-recruiter-starter' }).expect(201);
    const orderId = created.body.order.gatewayOrderId as string;

    // Invalid signature rejected
    await recruiterAgent
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_tampered_1',
        razorpay_signature: '00000000000000000000000000000000',
      })
      .expect(400);

    // Pending UPI payment (status = created) does NOT activate subscription
    mockPaymentStatus = 'created';
    const pendingVerify = await recruiterAgent
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_upi_pending_1',
        razorpay_signature: signCheckout(orderId, 'pay_upi_pending_1'),
      })
      .expect(200);
    expect(pendingVerify.body.verified).toBe(false);
    expect(pendingVerify.body.activated).toBe(false);
    expect(pendingVerify.body.status).toBe('pending');

    const subAfterPending = await recruiterAgent.get('/api/payments/subscription').expect(200);
    expect(subAfterPending.body.subscription).toBeNull();

    // Cancelled checkout updates order status cleanly
    const cancelled = await recruiterAgent
      .post(`/api/payments/orders/${orderId}/status-note`)
      .send({ status: 'cancelled', reason: 'User dismissed checkout' })
      .expect(200);
    expect(cancelled.body.order.status).toBe('cancelled');
  });

  it('verifies valid signature, activates subscription idempotently, and handles webhooks safely', async () => {
    const created = await recruiterAgent.post('/api/payments/orders').send({ planId: 'plan-recruiter-growth' }).expect(201);
    const orderId = created.body.order.gatewayOrderId as string;
    const paymentId = 'pay_upi_verified_777';

    mockPaymentStatus = 'captured';
    mockPaymentMethod = 'upi';

    const verified = await recruiterAgent
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signCheckout(orderId, paymentId),
      })
      .expect(200);
    expect(verified.body.verified).toBe(true);
    expect(verified.body.activated).toBe(true);
    expect(verified.body.transaction.method).toBe('upi');
    expect(verified.body.subscription.planId).toBe('plan-recruiter-growth');

    // Duplicate verify call does not create duplicate subscriptions
    await recruiterAgent
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signCheckout(orderId, paymentId),
      })
      .expect(200);
    const subCount = Number((getDb().prepare('SELECT COUNT(*) AS c FROM recruiter_subscriptions WHERE order_id = ?').get(created.body.order.id) as { c: number }).c);
    expect(subCount).toBe(1);

    // Webhook rejects invalid signature
    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      created_at: 1700000000,
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 249900,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
          },
        },
      },
    });

    await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'bad_sig_123456')
      .send(webhookBody)
      .expect(400);

    // Valid webhook processed once, duplicate event ignored idempotently
    const firstHook = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signWebhook(webhookBody))
      .set('x-razorpay-event-id', 'evt_unique_1001')
      .send(webhookBody)
      .expect(200);
    expect(firstHook.body.duplicate).toBe(false);

    const dupHook = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signWebhook(webhookBody))
      .set('x-razorpay-event-id', 'evt_unique_1001')
      .send(webhookBody)
      .expect(200);
    expect(dupHook.body.duplicate).toBe(true);

    // Order status retrieval works
    const statusRes = await recruiterAgent.get(`/api/payments/orders/${orderId}`).expect(200);
    expect(statusRes.body.order.status).toBe('captured');
  });

  it('supports idempotent order creation, UPI gateway status sync, and refund lockouts', async () => {
    // 1. Idempotency-Key returns the same gateway order without creating duplicates
    const idemKey = 'idem-recruiter-order-1';
    const first = await recruiterAgent
      .post('/api/payments/orders')
      .set('Idempotency-Key', idemKey)
      .send({ planId: 'plan-recruiter-starter' })
      .expect(201);
    const second = await recruiterAgent
      .post('/api/payments/orders')
      .set('Idempotency-Key', idemKey)
      .send({ planId: 'plan-recruiter-starter' })
      .expect(201);
    expect(second.body.order.gatewayOrderId).toBe(first.body.order.gatewayOrderId);

    // 2. Order status polling syncs failed UPI attempts cleanly and preserves failed over cancelled
    mockPaymentStatus = 'failed';
    const failedSync = await recruiterAgent.get(`/api/payments/orders/${first.body.order.gatewayOrderId}`).expect(200);
    expect(failedSync.body.order.status).toBe('failed');
    const keepFailed = await recruiterAgent
      .post(`/api/payments/orders/${first.body.order.gatewayOrderId}/status-note`)
      .send({ status: 'cancelled', reason: 'Modal closed after failure' })
      .expect(200);
    expect(keepFailed.body.order.status).toBe('failed');

    // 3. order.paid webhook activates subscription, and refund.processed revokes & locks out reactivation
    const order2 = await recruiterAgent.post('/api/payments/orders').send({ planId: 'plan-recruiter-starter' }).expect(201);
    const order2Id = order2.body.order.gatewayOrderId as string;
    const pay2Id = 'pay_upi_order_paid_2';

    const paidHookBody = JSON.stringify({
      event: 'order.paid',
      created_at: 1700000100,
      payload: {
        payment: {
          entity: {
            id: pay2Id,
            order_id: order2Id,
            amount: 99900,
            currency: 'INR',
            status: 'captured',
            method: 'upi',
          },
        },
      },
    });
    await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signWebhook(paidHookBody))
      .set('x-razorpay-event-id', 'evt_order_paid_2')
      .send(paidHookBody)
      .expect(200);

    const refundHookBody = JSON.stringify({
      event: 'refund.processed',
      created_at: 1700000200,
      payload: {
        refund: {
          entity: {
            id: 'rfnd_test_2',
            payment_id: pay2Id,
            amount: 99900,
            status: 'processed',
          },
        },
      },
    });
    await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signWebhook(refundHookBody))
      .set('x-razorpay-event-id', 'evt_refund_2')
      .send(refundHookBody)
      .expect(200);

    const statusAfterRefund = await recruiterAgent.get(`/api/payments/orders/${order2Id}`).expect(200);
    expect(statusAfterRefund.body.order.status).toBe('refunded');

    // Re-verifying a refunded order must be rejected and never reactivate subscription
    mockPaymentStatus = 'captured';
    await recruiterAgent
      .post('/api/payments/verify')
      .send({
        razorpay_order_id: order2Id,
        razorpay_payment_id: pay2Id,
        razorpay_signature: signCheckout(order2Id, pay2Id),
      })
      .expect(409);
  });
});
