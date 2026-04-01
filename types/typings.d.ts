export type SubkitCustomer = {
	customerId: string;
	email: string | null;
	userId?: string;
	name?: string | null;
	phone?: string | null;
	currency?: string | null;
	address?: {
		city?: string | null;
		country?: string | null;
		line1?: string | null;
		line2?: string | null;
		postal_code?: string | null;
		state?: string | null;
	} | null;
	balance: number;
	created: Date;
	metadata: Record<string, string>;
	stripeCustomer?: Stripe.Customer;
}


export type StripeSubKitSubscription = {
	id: string;
	customerId: string;
	status: SubscriptionStatus;
	userId?: string;
	priceId: string;
	productId: string;
	currency: string;
	unitAmount: number | null;
	interval: 'day' | 'week' | 'month' | 'year';
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	metadata: Record<string, string>;
}
export type SubscriptionStatus =
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'unpaid'
	| 'incomplete'
	| 'paused'
	| 'incomplete_expired';
