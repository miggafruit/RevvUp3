# 🚚 eHailing System — Full Stack (Bolt-style)

A real-time roadside assistance / eHailing system built on your existing AUTOMOTIVE-APP stack.
Clients request help → drivers receive it instantly → driver accepts → client tracks driver live on map.

---

## 📁 File Structure

```
AUTOMOTIVE-APP/
├── backend/
│   └── src/
│       ├── controllers/
│       │   └── ehailingController.js       ← All REST logic
│       ├── routes/
│       │   └── ehailingRoutes.js           ← API route definitions
│       └── config/
│           └── socket.js                   ← Socket.IO event handlers
│
└── mobile/
    └── src/
        ├── api/
        │   └── ehailingApi.ts              ← Axios API calls
        ├── hooks/
        │   └── useEHailingSocket.ts        ← Shared Socket.IO hook
        ├── context/
        │   └── EHailingContext.tsx         ← Optional global state
        ├── navigation/
        │   └── EHailingNavigator.tsx       ← Tab + stack navigator
        └── screens/
            ├── EHailingClientScreen.tsx    ← Client booking + live tracking
            ├── EHailingDriverScreen.tsx    ← Driver job list + map + complete
            └── EHailingHistoryScreen.tsx   ← Past requests
```

---

## ⚡ Quick Setup

### 1. Backend — Install dependencies

```bash
cd backend
npm install socket.io uuid
```

### 2. Backend — Update `server.js`

Replace your current `app.listen(...)` with the HTTP + Socket.IO pattern.
See **`server_integration.js`** for the exact code to copy in.

Key changes:
```js
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.set("io", io);          // makes io available in controllers
socketSetup(io);            // registers all socket events
app.use("/api/ehailing", ehailingRoutes);

server.listen(PORT, ...);   // use server.listen, NOT app.listen
```

### 3. Mobile — Install dependencies

```bash
cd mobile
npx expo install socket.io-client react-native-maps expo-location
npm install @react-native-picker/picker
```

### 4. Mobile — Set your API URL

In `mobile/.env` (or `mobile/.env.local`):
```
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_IP:5000
```
> ⚠️ Use your machine's **local network IP** (e.g. `192.168.1.x`), not `localhost`,
> when testing on a physical device.

### 5. Mobile — Register the navigator

In your root navigator (e.g. `AppNavigator.tsx`):
```tsx
import EHailingNavigator from "./EHailingNavigator";

// Inside your Stack.Navigator:
<Stack.Screen name="EHailing" component={EHailingNavigator} options={{ headerShown: false }} />
```

Optionally wrap with context in `App.tsx`:
```tsx
import { EHailingProvider } from "./src/context/EHailingContext";

export default function App() {
  return (
    <EHailingProvider>
      <NavigationContainer>
        ...
      </NavigationContainer>
    </EHailingProvider>
  );
}
```

---

## 🔄 Real-Time Flow (Bolt-style)

```
CLIENT                          SERVER                        DRIVER
  │                               │                              │
  │── POST /request ─────────────►│                              │
  │                               │── socket: new_request ──────►│
  │── socket: register_client ───►│                              │
  │                               │◄─ POST /request/:id/accept ──│
  │◄─ socket: request_accepted ───│                              │
  │                               │── socket: request_taken ────►│ (removes from list)
  │                               │                              │
  │◄─ socket: driver_location ────│◄─ socket: driver_location ───│ (every 4s)
  │                               │                              │
  │◄─ socket: driver_arrived ─────│◄─ POST /arrived ─────────────│
  │                               │                              │
  │◄─ socket: request_completed ──│◄─ POST /complete ────────────│
```

---

## 🌐 REST API Reference

| Method | Endpoint                              | Role   | Description                  |
|--------|---------------------------------------|--------|------------------------------|
| POST   | `/api/ehailing/request`               | Client | Create new request           |
| GET    | `/api/ehailing/request/:id`           | Both   | Poll request status          |
| POST   | `/api/ehailing/request/:id/cancel`    | Client | Cancel a request             |
| GET    | `/api/ehailing/requests/pending`      | Driver | List all open jobs           |
| POST   | `/api/ehailing/request/:id/accept`    | Driver | Accept a job                 |
| POST   | `/api/ehailing/request/:id/location`  | Driver | Push location update         |
| POST   | `/api/ehailing/request/:id/arrived`   | Driver | Mark as arrived              |
| POST   | `/api/ehailing/request/:id/complete`  | Driver | Mark as complete             |

---

## 🔌 Socket.IO Events

### Server → Client
| Event                     | Payload                              | Description                    |
|---------------------------|--------------------------------------|--------------------------------|
| `request_accepted`        | Full request object                  | Driver accepted the job        |
| `driver_location_update`  | `{ request_id, latitude, longitude}` | Driver moved                   |
| `driver_arrived`          | `{ request_id }`                     | Driver is on scene             |
| `request_completed`       | `{ request_id }`                     | Job done                       |

### Server → Driver(s)
| Event                        | Payload                    | Description                    |
|------------------------------|----------------------------|--------------------------------|
| `new_request`                | Full request object        | New job available              |
| `request_taken`              | `{ request_id }`           | Another driver got this job    |
| `request_cancelled`          | `{ request_id }`           | Client cancelled pending job   |
| `assigned_request_cancelled` | `{ request_id }`           | Active job cancelled by client |

### Client → Server (direct socket)
| Event             | Payload                                           | Description             |
|-------------------|---------------------------------------------------|-------------------------|
| `register_client` | `{ client_id }`                                   | Join personal room      |
| `register_driver` | `{ driver_id }`                                   | Join drivers room       |
| `driver_location` | `{ request_id, client_id, latitude, longitude }`  | Broadcast location      |

---

## 🗄️ Production Checklist

- [ ] Replace in-memory `requests[]` array in controller with your **MongoDB model**
- [ ] Add `client_id` / `driver_id` from your **JWT auth middleware** instead of hardcoded values
- [ ] Replace mock ETA with **Google Maps Directions API** or **OpenRouteService**
- [ ] Add push notifications (**Expo Notifications**) as Socket fallback when app is backgrounded
- [ ] Add a **rating/review** screen after completion
- [ ] Add a `GET /api/ehailing/requests?client_id=X` endpoint to power the history screen
- [ ] Set `PROVIDER_GOOGLE` and add your **Google Maps API key** in `app.json`
- [ ] Tighten Socket.IO `cors.origin` to your production domain
- [ ] Add a **Driver earnings** backend model to persist payouts

---

## 🧪 Testing Locally (Two Devices / Two Tabs)

1. Start backend: `cd backend && npm run dev`
2. Start Expo: `cd mobile && npx expo start`
3. Open the app on **Device A** → go to **Client** tab → fill in form → tap **Request Help Now**
4. Open the app on **Device B** (or same device, **Driver** tab) → see job appear instantly → tap **Accept Job**
5. Device A shows the driver on the map with live ETA
6. Device B taps **I've Arrived** → **Mark Complete**
7. Device A sees the completion screen 🎉
