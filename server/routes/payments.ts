import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { rateLimit, requireAuth, requireRole } from '../middleware/auth.js';
import {
  createPaymentOrder,
  getActiveSubscription,
  getPaymentConfig,
  getPaymentOrderStatus,
  listSubscriptionPlans,
  listUserTransactions,
  markOrderStatus,
  processRazorpayWebhook,
  verifyAndCapturePayment,
} from '../services/paymentService.js';
import { createPaymentOrderSchema, paymentFailureSchema, verifyPaymentSchema } from '../validation.js';

const router = Router();
const paymentLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: 'payments' });

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const config = getPaymentConfig();
    res.json({
      plans: listSubscriptionPlans(),
      gateway: {
        provider: config.gateway,
        configured: config.configured,
        webhookConfigured: config.webhookConfigured,
        mode: config.mode,
        upiSupported: config.upiSupported,
      },
    });
  }),
);

router.get(
  '/subscription',
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    res.json({
      subscription: getActiveSubscription(req.user!.id),
      transactions: listUserTransactions(req.user!.id),
    });
  }),
);

router.post(
  '/orders',
  paymentLimiter,
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const { planId } = createPaymentOrderSchema.parse(req.body);
    const idempotencyKey = req.header('idempotency-key') ?? undefined;
    const created = await createPaymentOrder(req.user!, planId, idempotencyKey);
    res.status(201).json(created);
  }),
);

router.post(
  '/verify',
  paymentLimiter,
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const input = verifyPaymentSchema.parse(req.body);
    const result = await verifyAndCapturePayment(req.user!, input);
    res.json(result);
  }),
);

router.post(
  '/orders/:orderId/status-note',
  paymentLimiter,
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const body = paymentFailureSchema.parse({ ...req.body, orderId: req.params.orderId });
    const order = markOrderStatus(req.user!, body.orderId, body.status, body.reason);
    res.json({ order });
  }),
);

router.get(
  '/orders/:orderId',
  requireAuth,
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const status = await getPaymentOrderStatus(req.user!, req.params.orderId);
    res.json(status);
  }),
);

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
        ? Buffer.from(req.body, 'utf8')
        : null;
    if (!rawBody) {
      throw new AppError(400, 'INVALID_WEBHOOK_BODY', 'Raw request body is required for webhook verification.');
    }
    const signature = req.header('x-razorpay-signature') ?? undefined;
    const eventId = req.header('x-razorpay-event-id') ?? undefined;
    const result = processRazorpayWebhook({ rawBody, signature, eventIdHeader: eventId });
    res.status(200).json(result);
  }),
);

export default router;
