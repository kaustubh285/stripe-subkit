# stripe-subkit

[![npm version](https://img.shields.io/npm/v/stripe-subkit)](https://www.npmjs.com/package/stripe-subkit) [![npm downloads](https://img.shields.io/npm/dm/stripe-subkit)](https://www.npmjs.com/package/stripe-subkit) [![license](https://img.shields.io/npm/l/stripe-subkit)](LICENSE)

A TypeScript-first developer experience kit for Stripe subscriptions that sits on top of the official Stripe Node SDK.

## Overview

**stripe-subkit** focuses on the hard, repetitive bits of subscription management that most tutorials leave to you: linking Stripe customers and subscriptions to your users, handling duplicate customers, and providing normalized subscription data and flows.

### Key Goals

- **Stripe-only focus** - No billing platform ambitions, pure Stripe integration
- **No assumptions** - Works with any auth system or ORM
- **Normalized flows** - Stop rewriting the same subscription patterns
- **TypeScript-first** - Full type safety and great DX

## Features

✅ **Customer Management**
- Find or create customers with intelligent deduplication
- Optional local user ID linking for flexible integration
- Handle multiple customers with the same email
- Works with or without user management systems

✅ **Subscription Management**  
- Get all subscriptions with flexible status filtering
- Retrieve user-specific subscriptions by userId or email
- Update subscriptions with action-based design (change plans, cancel, reactivate)
- Normalized subscription objects with consistent structure
- Automatic userId linking from customer metadata
- Efficient lookup strategies that leverage existing customer data

✅ **Clean API Design**
- No need to pass Stripe instances around
- TypeScript-first with full type safety
- Simple, intuitive method signatures

## Installation

```bash
npm install stripe stripe-subkit
# or
pnpm add stripe stripe-subkit
# or
bun add stripe stripe-subkit
```

You must also install and configure the official Stripe Node SDK.

## Quick Start

```typescript
import { createStripeSubkit } from 'stripe-subkit';
import Stripe from 'stripe';

// Initialize with your Stripe instance
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover"
});

const subkit = createStripeSubkit({
  stripe,
  customerStrategy: 'metadata-userId' // optional
});

// Find or create a customer with local user ID
const customer = await subkit.findOrCreateCustomer({ localUserId: 'user-123', email: 'user@example.com' });

// Or find/create a customer by email only
const customerByEmail = await subkit.findOrCreateCustomer({ email: 'user@example.com' });

// Get all active subscriptions
const allSubscriptions = await subkit.getAllSubscriptions();

// Get subscriptions for a specific user by userId
const userSubscriptions = await subkit.getUserSubscriptions({ userId: 'user-123' });

// Or get subscriptions by email
const emailSubscriptions = await subkit.getUserSubscriptions({ email: 'user@example.com' });

// Update a user's most recent active subscription
const updatedSub = await subkit.updateSubscription({
  userId: 'user-123',
  action: 'cancel-at-period-end',
  reason: 'Customer requested cancellation'
});
```

## API Reference

### `createStripeSubkit(config)`

Creates a new StripeSubkit instance.

**Parameters:**
- `config.stripe` - Your Stripe instance (required)
- `config.customerStrategy` - Strategy for customer resolution (optional)

**Returns:** StripeSubkit instance with the following methods:

### `findOrCreateCustomer({ localUserId?, email })`

Intelligently finds an existing customer or creates a new one.

**Parameters:**
- `localUserId?: string` - Your application's user ID (optional)
- `email: string` - Customer's email address

**Returns:** Promise<`SubkitCustomer`>

**Behavior:**
- First searches for customers by email
- If `localUserId` provided: links to your user ID or returns existing linked customer
- If `localUserId` not provided: returns first customer with matching email
- If not found, creates a new Stripe customer
- Handles email conflicts intelligently

### `findCustomer({ localUserId?, email })`

Finds an existing customer without creating a new one.

**Parameters:**
- `localUserId?: string` - Your application's user ID (optional)
- `email: string` - Customer's email address

**Returns:** Promise<`SubkitCustomer | null`>

**Behavior:**
- Returns `null` if no customer found
- If `localUserId` provided: searches for customer with matching email AND user ID
- If `localUserId` not provided: returns first customer with matching email

### `getAllSubscriptions(status?)`

Retrieves subscriptions from Stripe with normalized data.

**Parameters:**
- `status?: SubscriptionStatus | SubscriptionStatus[]` - Filter by subscription status (defaults to 'active')

**Returns:** Promise<`StripeSubKitSubscription[]`>

**Example:**
```typescript
// Get all active subscriptions (default)
const activeSubscriptions = await subkit.getAllSubscriptions();

// Get canceled subscriptions
const canceledSubscriptions = await subkit.getAllSubscriptions('canceled');

// Get multiple statuses
const multipleSubscriptions = await subkit.getAllSubscriptions(['active', 'past_due']);
```

### `getUserSubscriptions({ userId?, email? })`

Gets all subscriptions for a specific user by userId or email.

**Parameters:**
- `userId?: string` - Your application's user ID (optional)
- `email?: string` - Customer's email address (optional)
- Note: Either `userId` or `email` must be provided

**Returns:** Promise<`StripeSubKitSubscription[]`>

### `updateSubscription({ userId?, email?, action, ...options })`

Updates a user's most recent active subscription using action-based design that respects Stripe's actual capabilities.

**Parameters:**
- `userId?: string` - Your application's user ID (optional)
- `email?: string` - Customer's email address (optional)
- Note: Either `userId` or `email` must be provided
- `action: 'change-plan' | 'cancel-at-period-end' | 'cancel-now' | 'reactivate'` - The action to perform
- `newPriceId?: string` - Required for 'change-plan' action
- `prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'` - Proration behavior for plan changes
- `metadata?: Record<string, string>` - Additional metadata to store
- `reason?: string` - Your own reason string (stored in metadata with timestamp)

**Returns:** Promise<`StripeSubKitSubscription`>

**Behavior:**
- Finds the user's most recent active subscription automatically
- No need to manage Stripe subscription IDs
- Throws error if user has no active subscriptions

**Actions:**
- `'change-plan'`: Updates subscription items to new price
- `'cancel-at-period-end'`: Sets cancel_at_period_end to true
- `'cancel-now'`: Immediately cancels the subscription
- `'reactivate'`: Sets cancel_at_period_end to false (if scheduled to cancel)

**Example:**
```typescript
// Change subscription plan by userId
await subkit.updateSubscription({
  userId: 'user-123',
  action: 'change-plan',
  newPriceId: 'price_456...',
  prorationBehavior: 'create_prorations',
  reason: 'Customer upgraded to Pro plan'
});

// Cancel at period end by email
await subkit.updateSubscription({
  email: 'user@example.com',
  action: 'cancel-at-period-end',
  reason: 'Customer requested cancellation'
});
```

**Behavior:**
- Leverages existing customer finding logic for efficiency
- Returns empty array if no matching customer found
- Supports lookup by either userId or email for maximum flexibility

### `getSubscriptionsByCustomerId(customerId)`

Gets all subscriptions for a specific Stripe customer ID (optimized when you already have the customer ID).

**Parameters:**
- `customerId: string` - Stripe customer ID

**Returns:** Promise<`StripeSubKitSubscription[]`>

## Metadata Contract

**stripe-subkit** uses Stripe's customer metadata to link customers to your local user IDs:

- When you call `findOrCreateCustomer({ localUserId: 'user-123', email: '...' })`, the library stores `userId: 'user-123'` in the Stripe customer's metadata
- Functions like `getUserSubscriptions({ userId: 'user-123' })` use this metadata to efficiently find the right Stripe customer
- The `userId` field in `StripeSubKitSubscription` is automatically populated from the customer's metadata
- This linking is optional - you can use email-only workflows without any user ID tracking

## Types

### `StripeSubKitSubscription`

```typescript
export type StripeSubKitSubscription = {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  userId?: string; // derived from customer.metadata.userId when present
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
```

### `SubkitCustomer`

```typescript
export type SubkitCustomer = {
  customerId: string;
  email: string | null;
  userId?: string; // from metadata.userId, present only if localUserId was used
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
}
```

## Development

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

### Running Tests

```bash
bun test
```

Make sure to set your `STRIPE_SECRET_KEY` environment variable for testing.
