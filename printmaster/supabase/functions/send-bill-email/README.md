# `send-bill-email` (Supabase Edge Function)

This function sends **invoice created** and **payment received** emails automatically using your **Titan SMTP** (or any SMTP).

## Setup (Supabase CLI)

1) Install & login Supabase CLI.

2) From the `printmaster/` folder:

```bash
supabase functions deploy send-bill-email
```

3) Set secrets (example for Titan):

```bash
supabase secrets set \
  SMTP_HOST=smtp.titan.email \
  SMTP_PORT=587 \
  SMTP_USER=org@shiromani.xyz \
  SMTP_PASS=YOUR_TITAN_PASSWORD \
  FROM_EMAIL=org@shiromani.xyz \
  FROM_NAME="Shiromani"
```

## What it sends

- **Invoice created**: includes `View invoice` and `Pay now (QR)` links.\n
- **Payment received**: sent when a bill becomes paid.

## Triggered from app

The app calls `supabase.functions.invoke(\"send-bill-email\")` in:

- `BillingPage.createBill()` → invoice created\n
- `BillingPage.addPaymentToBill()` when bill becomes paid → payment received

