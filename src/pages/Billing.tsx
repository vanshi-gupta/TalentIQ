import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/PageHeader';
import { Badge, Button, Card } from '../components/ui/primitives';
import { ErrorState, LoadingState } from '../components/ui/states';
import { formatDate, formatDateTime, formatInr } from '../lib/utils';
import type { PaymentOrder, PaymentTransaction, SubscriptionPlan } from '../types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (resp: unknown) => void) => void };
  }
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Billing() {
  const toast = useToast();
  const { refresh: refreshAuth } = useAuth();
  const plansApi = useApi(api.payments.plans, []);
  const subApi = useApi(api.payments.subscription, []);

  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<PaymentOrder | null>(null);
  const [verifiedBanner, setVerifiedBanner] = useState<{ transaction: PaymentTransaction; planName: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ tone: 'info' | 'warning' | 'danger'; text: string } | null>(null);
  const [checkingOrder, setCheckingOrder] = useState(false);

  const plans = plansApi.data?.plans ?? [];
  const gateway = plansApi.data?.gateway;
  const subscription = subApi.data?.subscription;
  const transactions = subApi.data?.transactions ?? [];

  const startCheckout = async (plan: SubscriptionPlan) => {
    setBusyPlanId(plan.id);
    setStatusMessage(null);
    setVerifiedBanner(null);

    try {
      const { order, checkout } = await api.payments.createOrder(plan.id);
      setActiveOrder(order);

      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded || !window.Razorpay) {
        setStatusMessage({
          tone: 'danger',
          text: 'Unable to load Razorpay Checkout script. Check your internet connection and click "Check Order Status" or retry.',
        });
        setBusyPlanId(null);
        return;
      }

      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        order_id: checkout.orderId,
        prefill: checkout.prefill,
        retry: { enabled: true, max_count: 3 },
        theme: { color: '#7D5CE6' },
        modal: {
          ondismiss: async () => {
            try {
              await api.payments.markOrderStatus(order.gatewayOrderId, 'cancelled', 'Recruiter closed Razorpay checkout.');
              setStatusMessage({
                tone: 'warning',
                text: 'Checkout was closed before payment completed. No subscription was activated.',
              });
              const latest = await api.payments.orderStatus(order.gatewayOrderId);
              setActiveOrder(latest.order);
            } catch {
              // Ignore if already settled via webhook
            } finally {
              setBusyPlanId(null);
            }
          },
        },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verification = await api.payments.verify(response);
            setActiveOrder(verification.order);
            if (verification.verified && verification.activated) {
              setVerifiedBanner({ transaction: verification.transaction, planName: plan.name });
              toast.success('Payment verified! Your TalentIQ Recruiter plan is active.');
              subApi.reload();
              await refreshAuth();
            } else {
              setStatusMessage({
                tone: 'info',
                text: verification.message || 'Payment is awaiting gateway confirmation. Use Check Order Status shortly.',
              });
            }
          } catch (caught) {
            setStatusMessage({
              tone: 'danger',
              text: caught instanceof ApiError ? caught.message : 'Server signature verification failed. Entitlement was not activated.',
            });
          } finally {
            setBusyPlanId(null);
          }
        },
      });

      rzp.on('payment.failed', async (resp: unknown) => {
        const desc = (resp as { error?: { description?: string } })?.error?.description || 'Payment failed at gateway.';
        try {
          await api.payments.markOrderStatus(order.gatewayOrderId, 'failed', desc);
          const latest = await api.payments.orderStatus(order.gatewayOrderId);
          setActiveOrder(latest.order);
        } catch {
          // ignore
        }
        setStatusMessage({ tone: 'danger', text: `${desc} You can safely retry checkout.` });
        setBusyPlanId(null);
      });

      rzp.open();
    } catch (caught) {
      setStatusMessage({
        tone: 'danger',
        text: caught instanceof ApiError ? caught.message : 'Unable to start Razorpay checkout.',
      });
      setBusyPlanId(null);
    }
  };

  const refreshOrderStatus = async () => {
    if (!activeOrder) return;
    setCheckingOrder(true);
    try {
      const res = await api.payments.orderStatus(activeOrder.gatewayOrderId);
      setActiveOrder(res.order);
      if (res.order.status === 'captured' && res.subscription) {
        const tx = res.transactions[0];
        if (tx) setVerifiedBanner({ transaction: tx, planName: res.order.plan?.name ?? 'Recruiter Plan' });
        subApi.reload();
        await refreshAuth();
        toast.success('Payment verified from gateway!');
      } else {
        setStatusMessage({
          tone: 'info',
          text: `Current gateway order status: ${res.order.status.toUpperCase()}.`,
        });
      }
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Unable to retrieve order status.');
    } finally {
      setCheckingOrder(false);
    }
  };

  if (plansApi.loading && subApi.loading) return <LoadingState label="Loading subscription plans…" />;
  if (plansApi.error) return <ErrorState message={plansApi.error} onRetry={plansApi.reload} />;
  if (subApi.error) return <ErrorState message={subApi.error} onRetry={subApi.reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Secure Billing & UPI Checkout"
        title="Recruiter Plans & Billing"
        description="Server-verified Razorpay Standard Checkout supporting UPI, Cards, and NetBanking. Entitlements activate only after backend cryptographic verification."
      />

      {/* Gateway Configuration & Mode Notice */}
      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`rounded-xl p-2.5 ${gateway?.configured ? 'bg-mint-100 text-mint-700' : 'bg-butter-100 text-butter-700'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-bold text-plum-950">Razorpay Gateway Status</h2>
                {gateway?.configured ? (
                  <Badge variant={gateway.mode === 'live' ? 'success' : 'info'}>
                    {gateway.mode === 'live' ? 'Live Mode' : 'Test Mode Active'}
                  </Badge>
                ) : (
                  <Badge variant="warning">Credentials Not Configured</Badge>
                )}
                {gateway?.upiSupported && (
                  <Badge variant="success"><Smartphone className="h-3 w-3" /> UPI Supported via Hosted Checkout</Badge>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-plum-700">
                {gateway?.configured
                  ? 'Order amounts are computed strictly on the server. Razorpay handles UPI & card collection securely; TalentIQ never collects UPI PINs or card numbers.'
                  : 'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET in your root .env file. Checkout is disabled until real test or live credentials are provided.'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Verified Confirmation Banner */}
      {verifiedBanner && (
        <Card className="mb-6 border-[#8AD1B6] bg-mint-100/75 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-mint-700" />
            <div>
              <h2 className="font-display text-lg font-bold text-plum-950">Payment Verified!</h2>
              <p className="mt-1 text-sm text-plum-900">
                Your <strong>{verifiedBanner.planName}</strong> subscription is now active.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-plum-900">
                <span>Payment Ref: <strong>{verifiedBanner.transaction.gatewayPaymentId}</strong></span>
                <span>Order Ref: <strong>{verifiedBanner.transaction.gatewayOrderId}</strong></span>
                <span>Amount: <strong>{formatInr(verifiedBanner.transaction.amountPaise / 100)}</strong></span>
                <span>Method: <strong>{verifiedBanner.transaction.method || 'Razorpay'}</strong></span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Non-captured / Error / Pending Status */}
      {statusMessage && (
        <div
          className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            statusMessage.tone === 'danger'
              ? 'border-[#F7BCAA] bg-peach-100 text-peach-700'
              : statusMessage.tone === 'warning'
                ? 'border-[#F2D57A] bg-butter-100 text-butter-700'
                : 'border-[#A7CCF7] bg-babyblue-100 text-babyblue-700'
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs font-semibold">
            {statusMessage.tone === 'danger' ? <XCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          {activeOrder && (
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={checkingOrder} onClick={refreshOrderStatus}>
              Check Order Status
            </Button>
          )}
        </div>
      )}

      {/* Active Subscription Banner */}
      {subscription && (
        <Card className="mb-6 border-lavender-300 bg-gradient-to-r from-lavender-50 to-mint-100/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="success">Active Recruiter Plan</Badge>
              <h3 className="mt-2 font-display text-lg font-bold text-plum-950">{subscription.plan?.name}</h3>
              <p className="text-xs text-plum-700">Valid from {formatDate(subscription.startsAt)} to {formatDate(subscription.expiresAt)}</p>
            </div>
            <div className="text-right text-xs text-plum-700">
              <p>Verified transaction linked</p>
              <p className="font-mono text-[11px] font-semibold text-plum-950">{subscription.transactionId}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-plum-950">{plan.name}</h3>
                <Badge variant="violet">{plan.intervalDays === 365 ? 'Annual' : 'Monthly'}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-plum-700">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-plum-950">
                  {formatInr(plan.amountPaise / 100)}
                </span>
                <span className="text-xs text-plum-600">/{plan.intervalDays} days</span>
              </div>
              <ul className="mt-4 space-y-2 border-t border-lavender-100 pt-4">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-xs text-plum-900">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-700" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <Button
                className="w-full"
                icon={CreditCard}
                loading={busyPlanId === plan.id}
                disabled={!gateway?.configured || busyPlanId !== null}
                onClick={() => startCheckout(plan)}
              >
                {gateway?.configured ? 'Pay via UPI / Card (Razorpay)' : 'Configure Razorpay Keys in .env'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Active Order Status Lookup & Transaction History */}
      {activeOrder && (
        <Card className="mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              <div>
                <h3 className="font-display text-sm font-bold text-plum-950">Latest Checkout Order: {activeOrder.internalRef}</h3>
                <p className="text-xs text-plum-600">Gateway Order ID: {activeOrder.gatewayOrderId} · Status: {activeOrder.status}</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={checkingOrder} onClick={refreshOrderStatus}>
              Retrieve Live Status
            </Button>
          </div>
        </Card>
      )}

      {transactions.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-lavender-100 px-5 py-4">
            <h2 className="font-display text-base font-bold text-plum-950">Verified Payment Ledger</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-lavender-100 bg-ivory text-[11px] font-bold uppercase text-plum-600">
                  <th className="px-5 py-3">Payment ID</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3">Verified At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lavender-100 text-xs">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-5 py-3 font-mono text-plum-950">{tx.gatewayPaymentId}</td>
                    <td className="px-4 py-3 font-semibold text-plum-950">
                      <IndianRupee className="inline h-3 w-3" />{(tx.amountPaise / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 uppercase text-plum-700">{tx.method || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.status === 'captured' ? 'success' : tx.status === 'failed' ? 'danger' : 'warning'}>
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-plum-600">{formatDateTime(tx.verifiedAt ?? tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
