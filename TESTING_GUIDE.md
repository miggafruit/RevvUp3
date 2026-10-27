# RevvUp testing guide (delivery, approvals, clearance, phones)

## A. Test the delivery feature without money or a second phone

Render environment (temporary — delete before launch):
```
ALLOW_TEST_PAYMENTS=true
TEST_PAYMENT_EMAILS=<your client test email>
GOOGLE_MAPS_API_KEY=<needed: delivery fee uses real road distance>
```

**Option 1 – one phone (simulated driver).** Log in as the client test account, put a shop product in the cart, enter a real address at checkout (fee appears), place order. Log in as the shop, accept. Log in as the client, Pay Now -> "Test payment". The Track Delivery screen has a yellow **TESTER: simulate next step** button: driver accepts -> picked up -> delivered. No payouts are created.

**Option 2 – real driver flow (two phones/accounts).** Create a ready driver:
```
cd backend
CONFIRM=yes DRIVER_EMAIL=testdriver@example.com DRIVER_PASSWORD=Something123 npm run seed:test-driver
```
(run with MONGO_URI pointing at the database you want). Log in as that driver on a second phone, open Deliveries, tap Go online, then pay for an order as the client. The job appears; accept, pick up, deliver. Delete the test driver and test orders before launch.

**Delivery code (proof of delivery).** The client sees a 4-digit code on the Track Delivery screen once a driver accepts; the driver never sees it and must ask the client. Test with two accounts (Option 2): enter a wrong code twice -> "1 attempt left"; third wrong -> driver screen switches to "Take the order back to the shop", client is told, shop sees "Driver returning this order" with a confirm button; shop confirms -> stock restored, order flagged in admin ("Needs attention"), driver freed. A correct code at any of the 3 attempts completes the delivery and creates the payouts. (The yellow simulate button in Option 1 skips the code on purpose.)

Delivery checks: tier boundaries (7.9 kg / 8 kg / 35 kg / 36 kg), fee = base + per-km, Tier shown on the order, shop's payout excludes the delivery fee, driver's payout equals the delivery fee.

## B. Approval gate checks (all should be "hidden / blocked")
With a shop and a provider that are not_submitted / pending / rejected:
- not in Shops / Providers lists, not by direct link, products/services not in browse or search
- cannot be added to a cart by id, cannot be checked out, cannot receive part inquiries
- after admin approval they appear immediately; if they resubmit documents they disappear until re-approved

## C. Police clearance checks
- Register an individual provider with no certificate -> admin Approve button is disabled
- Register a business provider who does not drive -> no clearance asked
- Register a driver (delivery or tow), even as a business -> clearance asked and required
- Admin must tick "I have personally checked..." -> approved; provider becomes visible
- Certificate older than 180 days is refused at submission; after 365 days from issue the account drops out of listings/dispatch until renewed (Verification Status screen allows renewal)

## D. Phone matrix to test before launch
Minimum OS for this Expo version: iOS 16.4+ (iPhone 8 and newer). Android 7.0+ is the usual floor for this React Native generation (confirm in the EAS build output).
Test at least: a small/old Android (5.5", 2-3 GB RAM), a mid Android (Samsung A-series), a large Android, an older iPhone (8/SE 2nd gen), a current iPhone with notch/Dynamic Island, and one with large system text enabled. On each: register, upload a document by camera and gallery, place an order, pay, maps, push notification tap, rotate screen (app is portrait-only), background/foreground the app.
Cloud device farms (Firebase Test Lab for Android, BrowserStack/AWS Device Farm for both) can cover many models cheaply.

## Rewards, cash commission and earnings

Set `ALLOW_TEST_PAYMENTS=true` and `TEST_PAYMENT_EMAILS` on the backend first.

1. **Join rewards (provider/shop):** Dashboard → "RevvUp Rewards" → pay R150 (use the test button). The ⭐ REWARDS badge now shows on your profile, cards and listings, and you rank first in searches.
2. **Earn points (client):** Book/buy from a rewards provider with card. When the provider marks done and you confirm, the client sees a fireworks/balloons celebration and the points tally on the dashboard rises (10 points = R1, 2% of item subtotal).
3. **Redeem points:** Checkout on a service from a rewards provider → "Use my points". Points-only orders confirm without any card charge. Declined orders refund the points.
4. **Cash job:** Choose Cash at checkout (services only). Provider taps Mark Service Complete → "Yes, received" (cash). Client taps "Confirm done & cash paid". Then the provider's Earnings tab shows the 8% as owed to RevvUp (negative balance deducted from the next payout).
5. **Earnings tab:** Provider/shop Dashboard → Earnings. It updates live when both sides have confirmed, and for product orders when the driver completes delivery.
