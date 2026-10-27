import Stripe from 'stripe';
import config from '../../config';
import AppError from '../../error/AppError';
import httpStatus from 'http-status';
import { User } from '../user/user.models';

if (!config.stripe.stripe_api_secret) {
  throw new Error('STRIPE_API_SECRET is missing in configuration');
}

export const stripe = new Stripe(config.stripe.stripe_api_secret, {
  typescript: true,
});

/**
 * Ensures a Stripe Customer exists for the given User.
 * If user.stripeCustomerId is missing, creates a customer in Stripe and saves it to User document.
 */
export const getOrCreateStripeCustomer = async (userId: string): Promise<string> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (existingCustomer && !existingCustomer.deleted) {
        return user.stripeCustomerId;
      }
    } catch {
      // If customer retrieval fails, recreate below
    }
  }

  // Create customer in Stripe
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName || 'TonyPilot Neighbor',
    metadata: {
      userId: user._id.toString(),
    },
  });

  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
};

/**
 * Creates a Stripe Checkout Session for subscription checkout with auto-renewal and saved card behavior.
 */
export const createSubscriptionCheckoutSession = async ({
  customerId,
  stripePriceId,
  userId,
  planId,
}: {
  customerId: string;
  stripePriceId: string;
  userId: string;
  planId: string;
}): Promise<Stripe.Checkout.Session> => {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    // Saves payment method to customer for recurring automatic renewal
    payment_method_collection: 'always',
    saved_payment_method_options: {
      payment_method_save: 'enabled',
    },
    subscription_data: {
      metadata: {
        userId,
        planId,
      },
    },
    metadata: {
      userId,
      planId,
    },
    success_url: `${config.plan.success_url}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.plan.success_url,
  });

  return session;
};

/**
 * Creates a SetupIntent for explicitly saving a new card/payment method without charging.
 */
export const createCardSetupIntent = async (customerId: string): Promise<Stripe.SetupIntent> => {
  return await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // allows charging for future recurring renewals
  });
};

/**
 * Lists all saved cards/payment methods for a given customer.
 */
export const listCustomerCards = async (customerId: string) => {
  const customer = (await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })) as Stripe.Customer;

  const defaultPaymentMethodId =
    typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : (customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod)?.id;

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });

  return paymentMethods.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand || 'unknown',
    last4: pm.card?.last4 || '****',
    expMonth: pm.card?.exp_month || 0,
    expYear: pm.card?.exp_year || 0,
    isDefault: pm.id === defaultPaymentMethodId,
    cardholderName: pm.billing_details?.name || '',
  }));
};

/**
 * Sets a payment method as default for invoices / recurring auto-renewal.
 */
export const setDefaultCard = async (customerId: string, paymentMethodId: string) => {
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
};

/**
 * Detaches / removes a saved payment method.
 */
export const removeCard = async (paymentMethodId: string) => {
  return await stripe.paymentMethods.detach(paymentMethodId);
};

/**
 * Verifies and constructs Stripe Webhook event from raw buffer and signature header.
 */
export const verifyStripeWebhookEvent = (
  rawBody: Buffer | string,
  signature: string,
  secret: string
): Stripe.Event => {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
};
