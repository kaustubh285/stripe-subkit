import { config } from 'dotenv';

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Stripe from 'stripe';
import { createStripeSubkit } from '../src/main';
import type { SubkitCustomer } from '../types/typings';



config();

describe('Customer Management', () => {
	let subkit: ReturnType<typeof createStripeSubkit>;

	let stripe: Stripe;

	beforeAll(async () => {
		stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
			apiVersion: "2026-02-25.clover",
		});

		subkit = createStripeSubkit({
			stripe,
			customerStrategy: 'metadata-userId'
		})
	})



	it('should update subscription by userId', async () => {

		const subscriptions = await subkit.getUserSubscriptions({ userId: 'test-user-123' });

		if (subscriptions.length > 0 && subscriptions.some(sub => sub.status === 'active')) {
			const updatedSub = await subkit.updateSubscription({
				userId: 'test-user-123',
				action: 'cancel-at-period-end',
				reason: 'Test cancellation'
			});

			expect(updatedSub).toBeDefined();
			expect(updatedSub.cancelAtPeriodEnd).toBe(true);
			expect(updatedSub.metadata?.reason).toBe('Test cancellation');
			console.log('Updated subscription:', updatedSub);
		} else {
			console.log('Skipping update test - no active subscriptions found for user');
		}
	})

	it('should update subscription by email', async () => {

		const subscriptions = await subkit.getUserSubscriptions({ email: 'kdevdeshpande@gmail.com' });

		// if (subscriptions.length > 0 && subscriptions.some(sub => sub.status === 'active')) {
		if (subscriptions.length > 0) {
			const updatedSub = await subkit.updateSubscription({
				email: 'kdevdeshpande@gmail.com',
				action: 'reactivate',
				reason: 'Test reactivation'
			});

			expect(updatedSub).toBeDefined();
			expect(updatedSub.cancelAtPeriodEnd).toBe(false);
			console.log('Reactivated subscription:', updatedSub);
		} else {
			console.log('Skipping reactivate test - no active subscriptions found for user');
		}
	})

	it('should throw error when updating subscription with no user info', async () => {
		await expect(subkit.updateSubscription({
			action: 'cancel-now'
		})).rejects.toThrow('Either userId or email must be provided');
	})

	it('should throw error when user has no active subscriptions', async () => {
		await expect(subkit.updateSubscription({
			email: 'nonexistent@example.com',
			action: 'cancel-now'
		})).rejects.toThrow('No active subscriptions found for this user');
	})

	return;


	it('should retrieve subscriptions by status', async () => {
		const activeSubscriptions = await subkit.getAllSubscriptions('active');
		expect(Array.isArray(activeSubscriptions)).toBe(true);
		console.log('Active Subscriptions:', activeSubscriptions);

		const canceledSubscriptions = await subkit.getAllSubscriptions('canceled');
		expect(Array.isArray(canceledSubscriptions)).toBe(true);
		console.log('Canceled Subscriptions:', canceledSubscriptions);
	})

	it('should retrieve or create customer with localUserId', async () => {
		const customer: SubkitCustomer = await subkit.findOrCreateCustomer({ localUserId: 'test-user-123', email: 'kdevdeshpande@gmail.com' });

		expect(customer).toBeDefined();
		expect(customer.email).toBe('kdevdeshpande@gmail.com');
		expect(customer.metadata?.userId).toBe('test-user-123');
		expect(customer.customerId).toBeDefined();

		console.log('Customer:', customer);
	})

	it('should retrieve or create customer without localUserId', async () => {
		const customer: SubkitCustomer = await subkit.findOrCreateCustomer({ email: 'test-no-userid@example.com' });

		expect(customer).toBeDefined();
		expect(customer.email).toBe('test-no-userid@example.com');
		expect(customer.customerId).toBeDefined();
		// Should not have userId in metadata when not provided
		expect(customer.metadata?.userId).toBeFalsy();

		console.log('Customer without userId:', customer);
	})

	it('should retrieve customer with localUserId', async () => {
		const customer1: SubkitCustomer | null = await subkit.findCustomer({ localUserId: 'test-user-123', email: 'kdevdeshpande@gmail.com' });

		expect(customer1).toBeDefined();
		expect(customer1?.email).toBe('kdevdeshpande@gmail.com');
		expect(customer1?.metadata?.userId).toBe('test-user-123');
		expect(customer1?.customerId).toBeDefined();

		const customer2: SubkitCustomer | null = await subkit.findCustomer({ localUserId: 'test', email: 'random@gmail.com' });

		expect(customer2).toBeNull();
	})

	it('should retrieve customer by email only', async () => {
		const customer: SubkitCustomer | null = await subkit.findCustomer({ email: 'kdevdeshpande@gmail.com' });

		expect(customer).toBeDefined();
		expect(customer?.email).toBe('kdevdeshpande@gmail.com');
		expect(customer?.customerId).toBeDefined();

		const nonExistentCustomer: SubkitCustomer | null = await subkit.findCustomer({ email: 'nonexistent@example.com' });
		expect(nonExistentCustomer).toBeNull();
	})

	it('should retrieve user subscriptions by userId', async () => {
		const subscriptions = await subkit.getUserSubscriptions({ userId: 'test-user-123' });
		expect(Array.isArray(subscriptions)).toBe(true);
		console.log('User Subscriptions by userId:', subscriptions);
	})

	it('should retrieve user subscriptions by email', async () => {
		const subscriptions = await subkit.getUserSubscriptions({ email: 'kdevdeshpande@gmail.com' });
		expect(Array.isArray(subscriptions)).toBe(true);
		console.log('User Subscriptions by email:', subscriptions);
	})

	it('should handle getUserSubscriptions with no matching user', async () => {
		const subscriptions = await subkit.getUserSubscriptions({ email: 'nonexistent@example.com' });
		expect(Array.isArray(subscriptions)).toBe(true);
		expect(subscriptions.length).toBe(0);
	})

	it('should throw error when neither userId nor email provided', async () => {
		await expect(subkit.getUserSubscriptions({})).rejects.toThrow('Either userId or email must be provided');
	})

})
