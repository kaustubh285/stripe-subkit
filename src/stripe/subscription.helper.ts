import type Stripe from "stripe";
import type { StripeSubKitSubscription, SubscriptionStatus } from "../../types/typings";
import { shFindCustomer } from "./customer.helper";


function _normalizeSubscription(subscription: Stripe.Subscription): StripeSubKitSubscription {
	const item = subscription.items.data[0];
	if (!item) {
		throw new Error(`Subscription ${subscription.id} has no items`);
	}
	const price = item.price;


	let productId: string;
	if (typeof price.product === 'string') {
		productId = price.product;
	} else {
		productId = price.product.id;
	}


	let userId: string | undefined = undefined;
	if (typeof subscription.customer === 'object' && subscription.customer !== null && 'metadata' in subscription.customer) {
		userId = subscription.customer.metadata?.userId;
	}

	return {
		id: subscription.id,
		customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
		status: subscription.status as SubscriptionStatus,
		userId: userId,
		priceId: price.id,
		productId: productId,
		currency: price.currency,
		unitAmount: price.unit_amount,
		interval: price.recurring?.interval as 'day' | 'week' | 'month' | 'year',
		currentPeriodStart: new Date(subscription.current_period_start * 1000),
		currentPeriodEnd: new Date(subscription.current_period_end * 1000),
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		metadata: subscription.metadata || {},
	};
}

export async function shGetUserSubscriptions(stripe: Stripe, params: { userId?: string; email?: string }): Promise<StripeSubKitSubscription[]> {
	const { userId, email } = params;

	if (!userId && !email) {
		throw new Error('Either userId or email must be provided');
	}

	try {
		const customer = await shFindCustomer({ stripe, localUserId: userId, email });

		if (!customer) {
			return [];
		}

		const subscriptions = await stripe.subscriptions.list({
			customer: customer.customerId,
			limit: 100,
			expand: ['data.items.data.price', 'data.customer'],
		});

		return subscriptions.data.map(subscription => _normalizeSubscription(subscription));

	} catch (error) {
		throw new Error(`Failed to get user subscriptions: ${error instanceof Error ? error.message : error}`);
	}
}

export async function shGetSubscriptionsByCustomerId(stripe: Stripe, customerId: string): Promise<StripeSubKitSubscription[]> {
	try {
		const subscriptions = await stripe.subscriptions.list({
			customer: customerId,
			limit: 100,
			expand: ['data.items.data.price', 'data.customer'],
		});

		return subscriptions.data.map(subscription => _normalizeSubscription(subscription));

	} catch (error) {
		throw new Error(`Failed to get customer subscriptions: ${error instanceof Error ? error.message : error}`);
	}
}


export type UpdateSubscriptionAction = 'change-plan' | 'cancel-at-period-end' | 'cancel-now' | 'reactivate';

export interface UpdateSubscriptionParams {
	userId?: string;
	email?: string;
	action: UpdateSubscriptionAction;
	newPriceId?: string;
	prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
	metadata?: Record<string, string>;
	reason?: string;
}

export async function shUpdateSubscription(stripe: Stripe, params: UpdateSubscriptionParams): Promise<StripeSubKitSubscription> {
	const { userId, email, action, newPriceId, prorationBehavior, metadata, reason } = params;

	if (!userId && !email) {
		throw new Error('Either userId or email must be provided');
	}

	try {

		const userSubscriptions = await shGetUserSubscriptions(stripe, { userId, email });


		const activeSubscriptions = userSubscriptions.filter(sub => sub.status === 'active');

		if (activeSubscriptions.length === 0) {
			throw new Error('No active subscriptions found for this user');
		}


		const mostRecentSubscription = activeSubscriptions.sort((a, b) =>
			new Date(b.currentPeriodStart).getTime() - new Date(a.currentPeriodStart).getTime()
		)[0];

		if (!mostRecentSubscription) {
			throw new Error('No active subscriptions found for this user');
		}

		const subscriptionId = mostRecentSubscription.id;
		let updatedSubscription: Stripe.Subscription;


		const mergedMetadata = {
			...metadata,
			...(reason && { reason, updated_at: new Date().toISOString() })
		};

		switch (action) {
			case 'change-plan':
				if (!newPriceId) {
					throw new Error('newPriceId is required for change-plan action');
				}


				const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
				const subscriptionItem = currentSub.items.data[0];
				if (!subscriptionItem) {
					throw new Error(`Subscription ${subscriptionId} has no items`);
				}
				updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
					items: [{
						id: subscriptionItem.id,
						price: newPriceId,
					}],
					proration_behavior: prorationBehavior || 'create_prorations',
					metadata: mergedMetadata,
					expand: ['customer', 'items.data.price']
				});
				break;

			case 'cancel-at-period-end':
				updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
					cancel_at_period_end: true,
					metadata: mergedMetadata,
					expand: ['customer', 'items.data.price']
				});
				break;

			case 'reactivate':
				updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
					cancel_at_period_end: false,
					metadata: mergedMetadata,
					expand: ['customer', 'items.data.price']
				});
				break;

			case 'cancel-now':
				if (Object.keys(mergedMetadata).length > 0) {
					await stripe.subscriptions.update(subscriptionId, { metadata: mergedMetadata });
				}
				updatedSubscription = await stripe.subscriptions.cancel(subscriptionId, {
					expand: ['customer', 'items.data.price']
				});
				break;

			default:
				throw new Error(`Unsupported action: ${action}`);
		}

		return _normalizeSubscription(updatedSubscription);

	} catch (error) {
		throw new Error(`Failed to update subscription: ${error instanceof Error ? error.message : error}`);
	}
}

export async function shGetAllSubscriptions({ stripe, status }: { stripe: Stripe, status?: SubscriptionStatus | SubscriptionStatus[] }): Promise<StripeSubKitSubscription[]> {
	try {
		if (Array.isArray(status)) {
			const results = await Promise.all(
				status.map(s => shGetAllSubscriptions({ stripe, status: s }))
			);
			return results.flat();
		}

		const subscriptions: StripeSubKitSubscription[] = [];
		let hasMore = true;
		let startingAfter: string | undefined = undefined;

		while (hasMore) {
			const response = await stripe.subscriptions.list({
				limit: 100,
				starting_after: startingAfter,
				expand: ['data.items.data.price', 'data.customer'],
				status: status || 'active',
			});

			response.data.forEach(sub => subscriptions.push(_normalizeSubscription(sub)));

			hasMore = response.has_more;
			if (hasMore) {
				startingAfter = response.data[response.data.length - 1]?.id;
			}
		}

		return subscriptions;
	} catch (error) {
		throw new Error(`Failed to get subscriptions: ${error instanceof Error ? error.message : error}`);
	}
}
