# main_server module

The `main_server` repository now runs inside `all-schools-backend` under
`src/modules/mainServer`.

Existing endpoints are preserved:

- `POST /api/register`
- `POST /api/login`
- `GET /api/check-access`
- `POST /api/bus/update`
- `GET /api/bus`
- `POST /api/location/update`
- `POST /api/payment/upload`

Before deploying, copy these values from the old `main_server` Render service
to the `all-schools-backend` Render service:

- Copy `MONGO_URL` into `MAIN_SERVER_MONGO_URL`.
- Copy `TRACKER_KEY` without changing its value.

Then point the main app at the all-schools Render base URL. Suspend the old
service only after login, bus location, access, and payment upload are tested.
