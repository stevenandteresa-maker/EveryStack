import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Webhook } from 'svix';
import {
  createUserWithTenant,
  updateUserFromClerk,
} from '@everystack/shared/db';

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserEventData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserEventData;
}

/**
 * Extracts the primary email from Clerk user event data.
 */
function getPrimaryEmail(data: ClerkUserEventData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? '';
}

/**
 * Builds a display name from Clerk user data.
 * Falls back to the email prefix if no name is provided.
 */
function buildDisplayName(data: ClerkUserEventData): string {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }
  // Fallback: use email prefix
  const email = getPrimaryEmail(data);
  return email.split('@')[0] ?? 'User';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Webhook secret not configured' } },
      { status: 500 },
    );
  }

  // Read the raw body for signature verification
  const body = await request.text();

  // Extract Svix headers
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Missing webhook signature headers' } },
      { status: 400 },
    );
  }

  // Verify the webhook signature
  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid webhook signature' } },
      { status: 400 },
    );
  }

  // Route by event type
  switch (event.type) {
    case 'user.created': {
      const email = getPrimaryEmail(event.data);
      const name = buildDisplayName(event.data);

      await createUserWithTenant({
        clerkId: event.data.id,
        email,
        name,
      });

      return NextResponse.json({ received: true }, { status: 201 });
    }

    case 'user.updated': {
      const email = getPrimaryEmail(event.data);
      const name = buildDisplayName(event.data);

      await updateUserFromClerk(event.data.id, { email, name });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    default:
      // Acknowledge unrecognized events without processing
      return NextResponse.json({ received: true }, { status: 200 });
  }
}
