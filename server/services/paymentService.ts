import crypto from 'node:crypto';
import {
  getDb,
  logActivity,
  mapSubscriptionPlan,
  newId,
  nowIso,
  withTransaction,
  writeAuditLog,
} from '../database.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  PaymentOrder,
  PaymentOrderStatus,
  PaymentTransaction,
  RecruiterSubscription,
  SubscriptionPlan,
  User,
} from '../types.js';

export interface RazorpayGatewayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayGatewayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method?: string | null;
  error_description?: string | null;
}

export interface RazorpayGatewayAdapter {
  createOrder(params: {
    keyId: string;
    keySecret: string;
    amountPaise: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayGatewayOrder>;
  fetchPayment(params: {
    keyId: string;
    keySecret: string;
    paymentId: string;
  }): Promise<RazorpayGatewayPayment>;
  fetchOrderPayments(params: {
    keyId: string;
    keySecret: string;
    gatewayOrderId: string;
  }): Promise<RazorpayGatewayPayment[]>;
}

const defaultRazorpayAdapter: RazorpayGatewayAdapter = {
  async createOrder({ keyId, keySecret, amountPaise, currency, receipt, notes }) {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountPaise, currency, receipt, notes }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { description?: string } } & Partial<RazorpayGatewayOrder>;
      if (!response.ok || !payload.id) {
        throw new AppError(
          502,
          'GATEWAY_ORDER_FAILED',
          payload.error?.description || `Payment gateway returned HTTP ${response.status} while creating the order.`,
        );
      }
      return payload as RazorpayGatewayOrder;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError(504, 'GATEWAY_TIMEOUT', 'Payment gateway timed out while creating the order. Please retry.');
      }
      throw new AppError(502, 'GATEWAY_UNAVAILABLE', 'Unable to reach the Razorpay payment gateway. Check network connectivity and credentials.');
    } finally {
      clearTimeout(timeout);
    }
  },

  async fetchPayment({ keyId, keySecret, paymentId }) {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { description?: string } } & Partial<RazorpayGatewayPayment>;
      if (!response.ok || !payload.id) {
        throw new AppError(
          502,
          'GATEWAY_PAYMENT_FETCH_FAILED',
          payload.error?.description || `Unable to retrieve payment details from Razorpay (HTTP ${response.status}).`,
        );
      }
      return payload as RazorpayGatewayPayment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError(504, 'GATEWAY_TIMEOUT', 'Payment gateway timed out while verifying the transaction.');
      }
      throw new AppError(502, 'GATEWAY_UNAVAILABLE', 'Unable to reach Razorpay to verify payment status.');
    } finally {
      clearTimeout(timeout);
    }
  },

  async fetchOrderPayments({ keyId, keySecret, gatewayOrderId }) {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(gatewayOrderId)}/payments`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as { items?: RazorpayGatewayPayment[] };
      if (!response.ok) return [];
      return Array.isArray(payload.items) ? payload.items : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  },
};

let gatewayAdapter: RazorpayGatewayAdapter = defaultRazorpayAdapter;

export function setRazorpayGatewayAdapter(adapter?: RazorpayGatewayAdapter): void {
  gatewayAdapter = adapter ?? defaultRazorpayAdapter;
}

export function getPaymentConfig(): {
  configured: boolean;
  webhookConfigured: boolean;
  mode: 'unconfigured' | 'test' | 'live';
  keyId: string | null;
  upiSupported: boolean;
  gateway: 'razorpay';
} {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  const configured = Boolean(keyId && keySecret);
  const mode = !configured ? 'unconfigured' : keyId.startsWith('rzp_live_') ? 'live' : 'test';
  return {
    configured,
    webhookConfigured: Boolean(webhookSecret),
    mode,
    keyId: configured ? keyId : null,
    upiSupported: configured,
    gateway: 'razorpay',
  };
}

function requireGatewayCredentials(): { keyId: string; keySecret: string; mode: 'test' | 'live' } {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (!keyId || !keySecret) {
    throw new AppError(
      503,
      'PAYMENT_NOT_CONFIGURED',
      'Razorpay credentials are not configured on the server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env to enable UPI and card checkout.',
    );
  }
  return {
    keyId,
    keySecret,
    mode: keyId.startsWith('rzp_live_') ? 'live' : 'test',
  };
}

export function timingSafeHexEquals(expectedHex: string, actualHex: string): boolean {
  if (!expectedHex || !actualHex) return false;
  const expected = Buffer.from(expectedHex.trim().toLowerCase(), 'utf8');
  const actual = Buffer.from(actualHex.trim().toLowerCase(), 'utf8');
  if (expected.length !== actual.length || expected.length === 0) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function verifyRazorpayCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return timingSafeHexEquals(expected, signature);
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer | string, signature: string, webhookSecret: string): boolean {
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return timingSafeHexEquals(expected, signature);
}

export function listSubscriptionPlans(): SubscriptionPlan[] {
  const rows = getDb()
    .prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY amount_paise ASC')
    .all() as unknown as Parameters<typeof mapSubscriptionPlan>[0][];
  return rows.map(mapSubscriptionPlan);
}

export function requirePlan(planIdOrCode: string): SubscriptionPlan {
  const row = getDb()
    .prepare('SELECT * FROM subscription_plans WHERE (id = ? OR code = ?) AND is_active = 1')
    .get(planIdOrCode, planIdOrCode) as Parameters<typeof mapSubscriptionPlan>[0] | undefined;
  if (!row) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'The selected subscription plan does not exist or is inactive.');
  }
  return mapSubscriptionPlan(row);
}

interface OrderRow {
  id: string;
  internal_ref: string;
  user_id: string;
  plan_id: string;
  gateway: string;
  gateway_order_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  receipt: string;
  notes_json?: string;
  created_at: string;
  updated_at: string;
}

interface TransactionRow {
  id: string;
  order_id: string;
  user_id: string;
  plan_id: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  amount_paise: number;
  currency: string;
  method: string | null;
  status: string;
  signature_verified: number;
  verified_at: string | null;
  refund_id: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapOrder(row: OrderRow): PaymentOrder {
  return {
    id: row.id,
    internalRef: row.internal_ref,
    userId: row.user_id,
    planId: row.plan_id,
    gateway: 'razorpay',
    gatewayOrderId: row.gateway_order_id,
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    status: row.status as PaymentOrderStatus,
    receipt: row.receipt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransaction(row: TransactionRow): PaymentTransaction {
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    planId: row.plan_id,
    gatewayOrderId: row.gateway_order_id,
    gatewayPaymentId: row.gateway_payment_id,
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    method: row.method,
    status: row.status as PaymentOrderStatus,
    signatureVerified: Boolean(row.signature_verified),
    verifiedAt: row.verified_at,
    refundId: row.refund_id,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getActiveSubscription(userId: string): RecruiterSubscription | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM recruiter_subscriptions
       WHERE user_id = ? AND status = 'active' AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(userId, nowIso()) as
    | {
        id: string;
        user_id: string;
        plan_id: string;
        order_id: string;
        transaction_id: string;
        status: string;
        starts_at: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  const planRow = getDb().prepare('SELECT * FROM subscription_plans WHERE id = ?').get(row.plan_id) as
    | Parameters<typeof mapSubscriptionPlan>[0]
    | undefined;
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    orderId: row.order_id,
    transactionId: row.transaction_id,
    status: row.status as RecruiterSubscription['status'],
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    plan: planRow ? mapSubscriptionPlan(planRow) : undefined,
  };
}

export async function createPaymentOrder(user: User, planId: string, idempotencyKey?: string) {
  const { keyId, keySecret, mode } = requireGatewayCredentials();
  const plan = requirePlan(planId);
  const cleanIdempotencyKey = idempotencyKey?.trim().slice(0, 120) || null;

  if (cleanIdempotencyKey) {
    const recentOrders = getDb()
      .prepare(
        `SELECT * FROM payment_orders
         WHERE user_id = ? AND plan_id = ? AND status IN ('created', 'pending', 'authorized')
         ORDER BY created_at DESC LIMIT 10`,
      )
      .all(user.id, plan.id) as unknown as OrderRow[];

    const matched = recentOrders.find((row) => {
      try {
        const parsed = JSON.parse(row.notes_json || '{}') as { idempotencyKey?: string };
        return parsed.idempotencyKey === cleanIdempotencyKey;
      } catch {
        return false;
      }
    });

    if (matched) {
      return {
        order: { ...mapOrder(matched), plan },
        checkout: {
          keyId,
          orderId: matched.gateway_order_id,
          amountPaise: Number(matched.amount_paise),
          currency: 'INR' as const,
          name: 'TalentIQ',
          description: `${plan.name} (${plan.intervalDays} days)`,
          prefill: {
            name: user.fullName,
            email: user.email,
            contact: user.phone ?? '',
          },
          upiSupported: true,
          mode,
        },
      };
    }
  }

  const internalRef = `TIQ-ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const receipt = internalRef.slice(0, 40);

  const gatewayOrder = await gatewayAdapter.createOrder({
    keyId,
    keySecret,
    amountPaise: plan.amountPaise,
    currency: 'INR',
    receipt,
    notes: {
      internalRef,
      userId: user.id,
      planId: plan.id,
      planCode: plan.code,
    },
  });

  if (Number(gatewayOrder.amount) !== plan.amountPaise || gatewayOrder.currency !== 'INR') {
    throw new AppError(502, 'GATEWAY_AMOUNT_MISMATCH', 'Gateway order amount did not match server plan pricing.');
  }

  const id = newId();
  const ts = nowIso();
  getDb()
    .prepare(
      `INSERT INTO payment_orders (id, internal_ref, user_id, plan_id, gateway, gateway_order_id, amount_paise, currency, status, receipt, notes_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'razorpay', ?, ?, 'INR', 'created', ?, ?, ?, ?)`,
    )
    .run(
      id,
      internalRef,
      user.id,
      plan.id,
      gatewayOrder.id,
      plan.amountPaise,
      receipt,
      JSON.stringify({ mode, ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}) }),
      ts,
      ts,
    );

  writeAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'payment_order_created',
    targetType: 'payment_order',
    targetId: id,
    details: { planId: plan.id, gatewayOrderId: gatewayOrder.id, amountPaise: plan.amountPaise, mode },
  });

  const orderRow = getDb().prepare('SELECT * FROM payment_orders WHERE id = ?').get(id) as unknown as OrderRow;
  return {
    order: { ...mapOrder(orderRow), plan },
    checkout: {
      keyId,
      orderId: gatewayOrder.id,
      amountPaise: plan.amountPaise,
      currency: 'INR' as const,
      name: 'TalentIQ',
      description: `${plan.name} (${plan.intervalDays} days)`,
      prefill: {
        name: user.fullName,
        email: user.email,
        contact: user.phone ?? '',
      },
      upiSupported: true,
      mode,
    },
  };
}

function runAtomic<T>(inExistingTransaction: boolean, fn: () => T): T {
  return inExistingTransaction ? fn() : withTransaction(fn);
}

function activateSubscriptionAndRecordCapture(params: {
  order: OrderRow;
  gatewayPaymentId: string;
  amountPaise: number;
  currency: string;
  method: string | null;
  signatureVerified: boolean;
  rawPayload: unknown;
  inTransaction?: boolean;
}): { transaction: PaymentTransaction; subscription: RecruiterSubscription; alreadyActivated: boolean } {
  const database = getDb();
  const plan = requirePlan(params.order.plan_id);
  const ts = nowIso();
  const expiresAt = new Date(Date.now() + plan.intervalDays * 86_400_000).toISOString();

  return runAtomic(Boolean(params.inTransaction), () => {
    const existingSub = database
      .prepare('SELECT * FROM recruiter_subscriptions WHERE order_id = ?')
      .get(params.order.id) as { id: string } | undefined;

    let txRow = database
      .prepare('SELECT * FROM payment_transactions WHERE gateway_payment_id = ?')
      .get(params.gatewayPaymentId) as unknown as TransactionRow | undefined;

    if (!txRow) {
      const txId = newId();
      database
        .prepare(
          `INSERT INTO payment_transactions (id, order_id, user_id, plan_id, gateway_order_id, gateway_payment_id, amount_paise, currency, method, status, signature_verified, verified_at, raw_status_payload, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'captured', ?, ?, ?, ?, ?)`,
        )
        .run(
          txId,
          params.order.id,
          params.order.user_id,
          params.order.plan_id,
          params.order.gateway_order_id,
          params.gatewayPaymentId,
          params.amountPaise,
          params.currency,
          params.method,
          params.signatureVerified ? 1 : 0,
          ts,
          JSON.stringify(params.rawPayload ?? {}),
          ts,
          ts,
        );
      txRow = database.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txId) as unknown as TransactionRow;
    } else {
      database
        .prepare(
          `UPDATE payment_transactions
           SET status = 'captured', method = COALESCE(?, method), signature_verified = MAX(signature_verified, ?), verified_at = COALESCE(verified_at, ?), raw_status_payload = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(params.method, params.signatureVerified ? 1 : 0, ts, JSON.stringify(params.rawPayload ?? {}), ts, txRow.id);
      txRow = database.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txRow.id) as unknown as TransactionRow;
    }

    database.prepare("UPDATE payment_orders SET status = 'captured', updated_at = ? WHERE id = ?").run(ts, params.order.id);

    let alreadyActivated = false;
    if (existingSub) {
      alreadyActivated = true;
    } else {
      const subId = newId();
      database
        .prepare(
          `INSERT INTO recruiter_subscriptions (id, user_id, plan_id, order_id, transaction_id, status, starts_at, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .run(subId, params.order.user_id, params.order.plan_id, params.order.id, txRow.id, ts, expiresAt, ts, ts);
    }

    const subscription = getActiveSubscription(params.order.user_id)!;
    return {
      transaction: mapTransaction(txRow),
      subscription,
      alreadyActivated,
    };
  });
}

function recordNonCapturedPayment(params: {
  order: OrderRow;
  gatewayPaymentId: string;
  amountPaise: number;
  currency: string;
  method: string | null;
  status: 'pending' | 'authorized' | 'failed';
  signatureVerified: boolean;
  rawPayload: unknown;
  inTransaction?: boolean;
}): PaymentTransaction {
  const database = getDb();
  const ts = nowIso();
  return runAtomic(Boolean(params.inTransaction), () => {
    const existing = database
      .prepare('SELECT * FROM payment_transactions WHERE gateway_payment_id = ?')
      .get(params.gatewayPaymentId) as unknown as TransactionRow | undefined;

    if (existing && existing.status === 'captured') {
      return mapTransaction(existing);
    }

    if (params.order.status !== 'captured') {
      database.prepare('UPDATE payment_orders SET status = ?, updated_at = ? WHERE id = ?').run(params.status, ts, params.order.id);
    }

    if (existing) {
      database
        .prepare(
          `UPDATE payment_transactions
           SET status = ?, method = COALESCE(?, method), signature_verified = MAX(signature_verified, ?), raw_status_payload = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(params.status, params.method, params.signatureVerified ? 1 : 0, JSON.stringify(params.rawPayload ?? {}), ts, existing.id);
      const updated = database.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(existing.id) as unknown as TransactionRow;
      return mapTransaction(updated);
    }

    const txId = newId();
    database
      .prepare(
        `INSERT INTO payment_transactions (id, order_id, user_id, plan_id, gateway_order_id, gateway_payment_id, amount_paise, currency, method, status, signature_verified, verified_at, raw_status_payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      )
      .run(
        txId,
        params.order.id,
        params.order.user_id,
        params.order.plan_id,
        params.order.gateway_order_id,
        params.gatewayPaymentId,
        params.amountPaise,
        params.currency,
        params.method,
        params.status,
        params.signatureVerified ? 1 : 0,
        JSON.stringify(params.rawPayload ?? {}),
        ts,
        ts,
      );
    const created = database.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txId) as unknown as TransactionRow;
    return mapTransaction(created);
  });
}

export async function verifyAndCapturePayment(
  user: User,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) {
  const { keyId, keySecret } = requireGatewayCredentials();
  const order = getDb()
    .prepare('SELECT * FROM payment_orders WHERE gateway_order_id = ?')
    .get(payload.razorpay_order_id) as unknown as OrderRow | undefined;

  if (!order) {
    throw new AppError(404, 'PAYMENT_ORDER_NOT_FOUND', 'Payment order could not be found.');
  }
  if (order.user_id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to verify this payment order.');
  }

  const sigValid = verifyRazorpayCheckoutSignature(
    payload.razorpay_order_id,
    payload.razorpay_payment_id,
    payload.razorpay_signature,
    keySecret,
  );
  if (!sigValid) {
    writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'payment_signature_rejected',
      targetType: 'payment_order',
      targetId: order.id,
      details: { gatewayOrderId: payload.razorpay_order_id, gatewayPaymentId: payload.razorpay_payment_id },
    });
    throw new AppError(400, 'INVALID_PAYMENT_SIGNATURE', 'Payment signature verification failed. Entitlement was not activated.');
  }

  const gatewayPayment = await gatewayAdapter.fetchPayment({
    keyId,
    keySecret,
    paymentId: payload.razorpay_payment_id,
  });

  if (gatewayPayment.order_id !== order.gateway_order_id) {
    throw new AppError(400, 'PAYMENT_ORDER_MISMATCH', 'Payment ID does not belong to this order.');
  }
  if (Number(gatewayPayment.amount) !== Number(order.amount_paise) || gatewayPayment.currency !== order.currency) {
    throw new AppError(400, 'PAYMENT_AMOUNT_MISMATCH', 'Verified gateway amount does not match the order amount.');
  }

  if (order.status === 'refunded') {
    throw new AppError(409, 'ORDER_REFUNDED', 'This order has been refunded and cannot be activated.');
  }

  if (gatewayPayment.status === 'captured') {
    const result = activateSubscriptionAndRecordCapture({
      order,
      gatewayPaymentId: gatewayPayment.id,
      amountPaise: Number(gatewayPayment.amount),
      currency: gatewayPayment.currency,
      method: gatewayPayment.method ?? null,
      signatureVerified: true,
      rawPayload: gatewayPayment,
    });
    writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'payment_verified_captured',
      targetType: 'payment_transaction',
      targetId: result.transaction.id,
      details: { gatewayOrderId: order.gateway_order_id, gatewayPaymentId: gatewayPayment.id, method: gatewayPayment.method ?? null },
    });
    logActivity('payment_verified', `${user.fullName} activated ${result.subscription.plan?.name ?? 'Recruiter Plan'} (${gatewayPayment.method ?? 'Razorpay'}).`);
    return {
      verified: true,
      activated: true,
      status: 'captured' as const,
      transaction: result.transaction,
      subscription: result.subscription,
      order: { ...mapOrder(getDb().prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id) as unknown as OrderRow) },
    };
  }

  if (gatewayPayment.status === 'authorized' || gatewayPayment.status === 'created') {
    const pendingStatus = gatewayPayment.status === 'authorized' ? 'authorized' : 'pending';
    const transaction = recordNonCapturedPayment({
      order,
      gatewayPaymentId: gatewayPayment.id,
      amountPaise: Number(gatewayPayment.amount),
      currency: gatewayPayment.currency,
      method: gatewayPayment.method ?? null,
      status: pendingStatus,
      signatureVerified: true,
      rawPayload: gatewayPayment,
    });
    writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: `payment_${pendingStatus}`,
      targetType: 'payment_transaction',
      targetId: transaction.id,
      details: { gatewayStatus: gatewayPayment.status },
    });
    return {
      verified: false,
      activated: false,
      status: pendingStatus,
      message:
        pendingStatus === 'pending'
          ? 'UPI or gateway payment is pending confirmation. Your plan will activate once payment is captured.'
          : 'Payment is authorized and awaiting capture. Your plan has not been activated yet.',
      transaction,
      subscription: getActiveSubscription(user.id),
      order: mapOrder(getDb().prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id) as unknown as OrderRow),
    };
  }

  if (gatewayPayment.status === 'refunded') {
    const database = getDb();
    const ts = nowIso();
    withTransaction(() => {
      database.prepare("UPDATE payment_orders SET status = 'refunded', updated_at = ? WHERE id = ?").run(ts, order.id);
      database
        .prepare("UPDATE payment_transactions SET status = 'refunded', refunded_at = COALESCE(refunded_at, ?), updated_at = ? WHERE gateway_payment_id = ?")
        .run(ts, ts, gatewayPayment.id);
      database
        .prepare("UPDATE recruiter_subscriptions SET status = 'refunded', updated_at = ? WHERE order_id = ?")
        .run(ts, order.id);
    });
    throw new AppError(409, 'PAYMENT_REFUNDED', 'This payment was refunded and cannot activate a subscription.');
  }

  const transaction = recordNonCapturedPayment({
    order,
    gatewayPaymentId: gatewayPayment.id,
    amountPaise: Number(gatewayPayment.amount),
    currency: gatewayPayment.currency,
    method: gatewayPayment.method ?? null,
    status: 'failed',
    signatureVerified: true,
    rawPayload: gatewayPayment,
  });
  throw new AppError(402, 'PAYMENT_NOT_CAPTURED', gatewayPayment.error_description || 'Payment failed and was not captured.', {
    transactionId: transaction.id,
    status: transaction.status,
  });
}

export function markOrderStatus(
  user: User,
  gatewayOrderOrInternalId: string,
  status: 'failed' | 'cancelled',
  reason: string,
): PaymentOrder {
  const database = getDb();
  const order = database
    .prepare('SELECT * FROM payment_orders WHERE id = ? OR gateway_order_id = ?')
    .get(gatewayOrderOrInternalId, gatewayOrderOrInternalId) as unknown as OrderRow | undefined;
  if (!order) throw new AppError(404, 'PAYMENT_ORDER_NOT_FOUND', 'Payment order not found.');
  if (order.user_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'Not authorized to update this order.');
  if (order.status === 'captured' || order.status === 'refunded') {
    throw new AppError(409, 'ORDER_ALREADY_SETTLED', `This payment is already ${order.status}.`);
  }
  if (order.status === 'failed' && status === 'cancelled') {
    return mapOrder(order);
  }
  const ts = nowIso();
  database.prepare('UPDATE payment_orders SET status = ?, updated_at = ? WHERE id = ?').run(status, ts, order.id);
  writeAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: `payment_order_${status}`,
    targetType: 'payment_order',
    targetId: order.id,
    details: { reason },
  });
  return mapOrder(database.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id) as unknown as OrderRow);
}

export async function getPaymentOrderStatus(user: User, orderId: string) {
  const database = getDb();
  let order = database
    .prepare('SELECT * FROM payment_orders WHERE id = ? OR gateway_order_id = ?')
    .get(orderId, orderId) as unknown as OrderRow | undefined;
  if (!order) throw new AppError(404, 'PAYMENT_ORDER_NOT_FOUND', 'Payment order not found.');
  if (order.user_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'Not authorized to view this payment order.');

  // If order is still created/pending/authorized and Razorpay keys exist, query real gateway order payments to sync delayed UPI callbacks.
  const config = getPaymentConfig();
  if (config.configured && (order.status === 'created' || order.status === 'pending' || order.status === 'authorized')) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const items = await gatewayAdapter.fetchOrderPayments({
      keyId: config.keyId!,
      keySecret,
      gatewayOrderId: order.gateway_order_id,
    });
    const captured = items.find(
      (item) => item.status === 'captured' && Number(item.amount) === Number(order!.amount_paise) && item.currency === order!.currency,
    );
    if (captured) {
      const result = activateSubscriptionAndRecordCapture({
        order,
        gatewayPaymentId: captured.id,
        amountPaise: Number(captured.amount),
        currency: captured.currency,
        method: captured.method ?? null,
        signatureVerified: false,
        rawPayload: captured,
      });
      writeAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'payment_synced_captured',
        targetType: 'payment_transaction',
        targetId: result.transaction.id,
        details: { gatewayOrderId: order.gateway_order_id, gatewayPaymentId: captured.id, method: captured.method ?? null },
      });
      order = database.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id) as unknown as OrderRow;
    } else {
      const authorized = items.find(
        (item) => item.status === 'authorized' && Number(item.amount) === Number(order!.amount_paise) && item.currency === order!.currency,
      );
      const latestFailed = !authorized
        ? items.find(
            (item) => item.status === 'failed' && Number(item.amount) === Number(order!.amount_paise) && item.currency === order!.currency,
          )
        : undefined;
      const syncCandidate = authorized ?? latestFailed;
      if (syncCandidate) {
        recordNonCapturedPayment({
          order,
          gatewayPaymentId: syncCandidate.id,
          amountPaise: Number(syncCandidate.amount),
          currency: syncCandidate.currency,
          method: syncCandidate.method ?? null,
          status: syncCandidate.status === 'authorized' ? 'authorized' : 'failed',
          signatureVerified: false,
          rawPayload: syncCandidate,
        });
        order = database.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id) as unknown as OrderRow;
      }
    }
  }

  const plan = requirePlan(order.plan_id);
  const transactions = (
    database
      .prepare('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC')
      .all(order.id) as unknown as TransactionRow[]
  ).map(mapTransaction);
  const subscription = getActiveSubscription(user.id);
  return { order: { ...mapOrder(order), plan }, transactions, subscription };
}

export function listUserTransactions(userId: string) {
  const rows = getDb()
    .prepare('SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as unknown as TransactionRow[];
  return rows.map(mapTransaction);
}

interface RazorpayWebhookPayload {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayGatewayPayment };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
  };
}

export function processRazorpayWebhook(params: {
  rawBody: Buffer;
  signature: string | undefined;
  eventIdHeader: string | undefined;
}) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  if (!webhookSecret) {
    throw new AppError(503, 'WEBHOOK_NOT_CONFIGURED', 'RAZORPAY_WEBHOOK_SECRET is not configured on the server.');
  }
  if (!params.signature) {
    throw new AppError(400, 'MISSING_WEBHOOK_SIGNATURE', 'Missing x-razorpay-signature header.');
  }
  const signatureValid = verifyRazorpayWebhookSignature(params.rawBody, params.signature, webhookSecret);
  if (!signatureValid) {
    writeAuditLog({
      action: 'payment_webhook_invalid_signature',
      targetType: 'webhook',
      details: { eventId: params.eventIdHeader ?? null },
    });
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.');
  }

  let parsed: RazorpayWebhookPayload;
  try {
    parsed = JSON.parse(params.rawBody.toString('utf8')) as RazorpayWebhookPayload;
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Invalid webhook JSON payload.');
  }

  const eventType = String(parsed.event || 'unknown');
  const paymentEntity = parsed.payload?.payment?.entity;
  const refundEntity = parsed.payload?.refund?.entity;
  const gatewayOrderId = paymentEntity?.order_id ?? null;
  const gatewayPaymentId = paymentEntity?.id ?? refundEntity?.payment_id ?? null;
  const fallbackEventId = crypto
    .createHash('sha256')
    .update(`${eventType}:${gatewayOrderId ?? ''}:${gatewayPaymentId ?? ''}:${parsed.created_at ?? ''}`)
    .digest('hex');
  const eventId = params.eventIdHeader?.trim() || fallbackEventId;

  const database = getDb();
  const existingEvent = database
    .prepare('SELECT id, processed FROM payment_webhook_events WHERE gateway_event_id = ?')
    .get(eventId) as { id: string; processed: number } | undefined;

  if (existingEvent?.processed === 1) {
    return { received: true, duplicate: true, eventType, eventId };
  }

  const ts = nowIso();
  const webhookRowId = existingEvent?.id ?? newId();

  withTransaction(() => {
    if (!existingEvent) {
      database
        .prepare(
          `INSERT INTO payment_webhook_events (id, gateway_event_id, event_type, gateway_order_id, gateway_payment_id, signature_valid, processed, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        )
        .run(webhookRowId, eventId, eventType, gatewayOrderId, gatewayPaymentId, params.rawBody.toString('utf8'), ts);
    }

    if (paymentEntity && gatewayOrderId) {
      const order = database
        .prepare('SELECT * FROM payment_orders WHERE gateway_order_id = ?')
        .get(gatewayOrderId) as unknown as OrderRow | undefined;

      if (order && order.status !== 'refunded') {
        const amountValid = Number(paymentEntity.amount) === Number(order.amount_paise) && paymentEntity.currency === order.currency;
        if (!amountValid) {
          writeAuditLog({
            action: 'payment_webhook_amount_mismatch',
            targetType: 'payment_order',
            targetId: order.id,
            details: { eventType, eventId, gatewayPaymentId, paymentAmount: paymentEntity.amount, orderAmount: order.amount_paise },
          });
        } else if ((eventType === 'payment.captured' || eventType === 'order.paid') && paymentEntity.status === 'captured') {
          activateSubscriptionAndRecordCapture({
            order,
            gatewayPaymentId: paymentEntity.id,
            amountPaise: Number(paymentEntity.amount),
            currency: paymentEntity.currency,
            method: paymentEntity.method ?? null,
            signatureVerified: true,
            rawPayload: parsed,
            inTransaction: true,
          });
        } else if (eventType === 'payment.authorized' || paymentEntity.status === 'authorized') {
          recordNonCapturedPayment({
            order,
            gatewayPaymentId: paymentEntity.id,
            amountPaise: Number(paymentEntity.amount),
            currency: paymentEntity.currency,
            method: paymentEntity.method ?? null,
            status: 'authorized',
            signatureVerified: true,
            rawPayload: parsed,
            inTransaction: true,
          });
        } else if (eventType === 'payment.failed' || paymentEntity.status === 'failed') {
          recordNonCapturedPayment({
            order,
            gatewayPaymentId: paymentEntity.id,
            amountPaise: Number(paymentEntity.amount),
            currency: paymentEntity.currency,
            method: paymentEntity.method ?? null,
            status: 'failed',
            signatureVerified: true,
            rawPayload: parsed,
            inTransaction: true,
          });
        }
      }
    }

    if ((eventType === 'refund.processed' || eventType === 'refund.created') && refundEntity?.payment_id) {
      const tx = database
        .prepare('SELECT * FROM payment_transactions WHERE gateway_payment_id = ?')
        .get(refundEntity.payment_id) as unknown as TransactionRow | undefined;
      if (tx) {
        database
          .prepare("UPDATE payment_transactions SET status = 'refunded', refund_id = ?, refunded_at = ?, updated_at = ? WHERE id = ?")
          .run(refundEntity.id ?? null, ts, ts, tx.id);
        database.prepare("UPDATE payment_orders SET status = 'refunded', updated_at = ? WHERE id = ?").run(ts, tx.order_id);
        database.prepare("UPDATE recruiter_subscriptions SET status = 'refunded', updated_at = ? WHERE transaction_id = ?").run(ts, tx.id);
        writeAuditLog({
          action: 'payment_refund_processed',
          targetType: 'payment_transaction',
          targetId: tx.id,
          details: { refundId: refundEntity.id ?? null, gatewayPaymentId: refundEntity.payment_id, eventType },
        });
      }
    }

    database.prepare('UPDATE payment_webhook_events SET processed = 1 WHERE id = ?').run(webhookRowId);
  });

  writeAuditLog({
    action: 'payment_webhook_processed',
    targetType: 'webhook',
    targetId: webhookRowId,
    details: { eventType, eventId, gatewayOrderId, gatewayPaymentId },
  });

  return { received: true, duplicate: false, eventType, eventId };
}
