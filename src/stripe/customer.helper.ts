import Stripe from 'stripe';
import type { SubkitCustomer } from '../../types/typings';


async function _normalizeCustomer(customer: Stripe.Customer): Promise<SubkitCustomer> {
	return {
		customerId: customer.id,
		email: customer.email,
		userId: customer.metadata?.userId,
		name: customer.name,
		phone: customer.phone,
		currency: customer.currency,
		address: customer.address ? {
			city: customer.address.city,
			country: customer.address.country,
			line1: customer.address.line1,
			line2: customer.address.line2,
			postal_code: customer.address.postal_code,
			state: customer.address.state,
		} : null,
		balance: customer.balance,
		created: new Date(customer.created * 1000),
		metadata: customer.metadata || {},
	};
}

export async function shFindOrCreateCustomer({ stripe, localUserId, email }: { stripe: Stripe, localUserId?: string, email: string }): Promise<SubkitCustomer> {
	try {
		const existingCustomer = await shFindCustomer({ stripe, localUserId, email });
		if (existingCustomer) {
			return existingCustomer
		}

		const newCustomer = await stripe.customers.create({
			email,
			metadata: localUserId ? { userId: localUserId } : {}
		});

		return _normalizeCustomer(newCustomer);

	} catch (error) {
		throw new Error(`Failed to resolve customer: ${error instanceof Error ? error.message : error}`);
	}
}



export async function shFindCustomer({ stripe, localUserId, email }: { stripe: Stripe, localUserId?: string, email: string }): Promise<SubkitCustomer | null> {
	try {
		const existingByEmail = await stripe.customers.list({
			email: email,
			limit: 100
		});

		if (existingByEmail.data.length > 0) {
			if (!localUserId && existingByEmail.data[0]) {
				return _normalizeCustomer(existingByEmail.data[0]);
			}

			const customerWithUserId = existingByEmail.data.find(c => c.metadata?.userId === localUserId);

			if (customerWithUserId) {
				return _normalizeCustomer(customerWithUserId);
			}


			const customerWithoutUserId = existingByEmail.data.find(c => !c.metadata?.userId);

			if (customerWithoutUserId) {

				await stripe.customers.update(customerWithoutUserId.id, {
					metadata: { ...customerWithoutUserId.metadata, userId: localUserId! }
				});
				return _normalizeCustomer(customerWithoutUserId);
			}

		}

		return null

	} catch (error) {
		throw new Error(`Failed to resolve customer: ${error instanceof Error ? error.message : error}`);
	}
}
