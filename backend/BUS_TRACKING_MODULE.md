# Bus Tracking Module

The former `Map_Bustracking_Backend` API now runs inside this backend under
`src/modules/busTracking`.

## Existing API paths

- `POST /api/register`
- `POST /api/login`
- `POST /api/location/update`
- `GET /api/buses`
- `POST /api/payment-sms`

The paths and request/response shapes are unchanged, so the existing Flutter
bus-tracking app only needs its base URL changed to the all-schools backend.

## Render environment

Add `BUS_TRACKING_MONGO_URI` to the all-schools Render service and copy its
value from the old Map Bus Tracking service. This preserves existing bus,
user, and payment data. If it is omitted, the module falls back to `MONGO_URI`.

After the merged backend has been deployed and the Flutter app has been tested,
the old Map Bus Tracking Render service can be suspended.
