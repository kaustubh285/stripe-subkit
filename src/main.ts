import Stripe from "stripe";
import { shFindCustomer, shFindOrCreateCustomer } from "./stripe/customer.helper";
import { shGetAllSubscriptions, shGetUserSubscriptions, shGetSubscriptionsByCustomerId, shUpdateSubscription, type UpdateSubscriptionParams } from "./stripe/subscription.helper";
import type { SubscriptionStatus } from "../types/typings";

export type CustomerStrategy = 'metadata-userId' | 'by-id-only' | 'by-id-then-email' | 'always-new';
export interface StripeSubkitConfig {
	stripe: Stripe;
	customerStrategy?: 'metadata-userId';
	// customerStrategy?: CustomerStrategy;
}

export function createStripeSubkit(config?: StripeSubkitConfig) {
	let stripe: Stripe;
	if (!config || !config.stripe) {
		stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
	} else {
		({ stripe } = config);
	}

	return {
		getUserSubscriptions: (params: { userId?: string; email?: string }) => shGetUserSubscriptions(stripe, params),
		getSubscriptionsByCustomerId: (customerId: string) => shGetSubscriptionsByCustomerId(stripe, customerId),
		getAllSubscriptions: (status?: SubscriptionStatus | SubscriptionStatus[]) => shGetAllSubscriptions({ stripe, status }),
		updateSubscription: (params: UpdateSubscriptionParams) => shUpdateSubscription(stripe, params),
		findCustomer: ({ localUserId, email }: { localUserId?: string, email: string }) => shFindCustomer({ stripe, localUserId, email }),
		findOrCreateCustomer: ({ localUserId, email }: { localUserId?: string, email: string }) => shFindOrCreateCustomer({ stripe, localUserId, email })
	}
}
