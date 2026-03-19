# EUDI Wallet Integration – Projektdokumentation

> **Stand:** März 2026
> **Zweck:** Diese Datei dokumentiert alles, was gebaut wurde, warum, wie es funktioniert und wo wir im Prozess stehen. Zum schnellen Wiedereinstieg nach einer längeren Pause.

---

## Was wird gebaut?

Zwei POCs (Proof of Concepts) rund um das EU Digital Identity Wallet (EUDI Wallet):

### POC 1: Bewerbungsformular (OpenID4VP – Lesen aus dem Wallet)

Immomio POC – eine Wohnungsbewerber-App mit 5-Schritt-Formular. Ziel: Nutzer können ihre persönlichen Daten **automatisch aus einem EU Digital Identity Wallet** (EUDI Wallet) befüllen lassen, statt sie manuell einzutippen.

Die Daten kommen als **PID (Person Identification Data)** aus dem Wallet – kryptografisch signiert, verifiziert von einer staatlichen Stelle (in DE: Bundesdruckerei). Das schafft Vertrauen für den Vermieter.

**Protokoll:** OpenID for Verifiable Presentations (OpenID4VP), gemäß eIDAS 2.0 / ARF

**Status: ✅ End-to-End funktioniert** – Wallet-Präsentation wird erfolgreich empfangen, validiert und die PID-Daten werden ins Formular übernommen.

### POC 2: Credential-Ausstellung (OpenID4VCI – Schreiben ins Wallet)

Frontend unter `/ausstellen`, zwei Credential-Typen: **Wohnungsgeberbestätigung** und **Genossenschafts-Mitgliedsbescheinigung**.

**Flow:** PID-Verifizierung (bestehender OpenID4VP-Flow) → Credential-Vorschau → Ausstellung als SD-JWT-VC via `openid-credential-offer://`

**Protokoll:** OpenID for Verifiable Credential Issuance (OpenID4VCI), Pre-Authorized Code Flow

**Status: ⚠️ Backend + Frontend implementiert, wartet auf SPRIND Wallet Update.** Die Wallet hat das Credential Offer korrekt abgerufen, stürzt aber intern ab. SPRIND hat bestätigt, dass Issuance in v0.2.0 noch nicht ausgereift ist – vollständiger Feature-Support kommt im nächsten Sprint.

---

## Warum zwei Teile?

Der EUDI Wallet Service muss:
- Eine **Access Certificate** besitzen (ausgestellt vom EUDI Sandbox, bindet den Service an einen public DNS-Namen)
- Über eine **öffentliche HTTPS-URL** erreichbar sein (Wallet-App verbindet sich direkt)
- Private Schlüssel sicher verwalten

Das passt nicht in die Next.js-Frontend-App. Deshalb:

| Teil | Technologie | Deployment |
|------|-------------|------------|
| `eudi-wallet-service/` | Node.js + Hono + TypeScript | Railway |
| `web/` | Next.js (existierende App) | lokal / Vercel |

---

## Architektur / Ablauf

```
web/ (Next.js, localhost:3000)      eudi-wallet-service/ (Railway)
         |                                      |
  Button "Mit Wallet ausfüllen"                 |
         |── POST /initiate ─────────────────>  |  generiert nonce, Session, JAR
         |<── { sessionId, walletUrl } ─────── |
         |                                      |
  Desktop: QR-Code anzeigen                     |
           startet sofort polling               |
  Mobile:  öffnet Wallet Deep Link direkt       |
           startet sofort polling               |
                                                |
  [User scannt QR / öffnet Deep Link]           |
  Wallet-App ──GET /request/:id──────────────>  |  liefert signierten JAR (JWT)
  Wallet-App ──POST /callback/:id────────────>  |  empfängt VP Token, validiert,
                                                |  speichert PID-Claims in Session
                                                |  → leitet Wallet-Browser zu /done/:id
         |── GET /result/:id ─────────────────> |  (polling alle 2s)
         |<── { status, pidClaims } ─────────── |
         |                                      |
  Formularfelder befüllen (Schritt 2, 3, 4)
  "Aus Wallet" Badges anzeigen
```

**Zwei Flows:**
- **QR Code (Cross-Device):** Desktop zeigt QR, User scannt mit Wallet-App auf Handy. Desktop startet sofort mit Polling.
- **Deep Link (Same-Device):** Mobile öffnet den `openid4vp://` Deep Link direkt in `handleStart()` (kein zweiter "Wallet öffnen" Button) und startet sofort Polling. Nach Wallet-Präsentation: Wallet öffnet `/done/:id` → `window.close()` schließt den Tab → Bewerbungs-Tab kommt in den Vordergrund.
- Frontend erkennt Gerät automatisch (User Agent).

### Architektur / Ablauf – Credential-Ausstellung (OpenID4VCI)

```
/ausstellen (Next.js)                eudi-wallet-service/ (Railway)
         |                                      |
  Credential-Typ auswählen                      |
  → /ausstellen/[type]                          |
         |                                      |
  Schritt 1: Identität verifizieren             |
         |── POST /issuer/initiate ──────────>  |  erstellt VP-Session (PID) + Issuance-Session
         |<── { sessionId, vpSessionId,         |  verknüpft VP-Session mit Issuance-Session
         |      walletUrl } ────────────────── |
         |                                      |
  QR-Code / Deep Link (openid4vp://)            |
  Polling: GET /issuer/result/:id               |
         |                                      |
  Wallet ──GET /request/:vpId──────────────>    |  liefert JAR für PID-Anforderung
  Wallet ──POST /callback/:vpId────────────>    |  PID validieren → auto-link zu Issuance-Session
         |                                      |
         |<── { status: pid_verified,           |  polling erkennt PID
         |      pidClaims } ───────────────── |
         |                                      |
  Schritt 2: Credential-Vorschau anzeigen       |
  (PID-Felder + Mock-Bescheinigungsdaten)       |
         |                                      |
  Schritt 3: "Weiter zur Ausstellung"           |
         |── POST /issuer/create-offer/:id ──>  |  erstellt openid-credential-offer://
         |<── { walletUrl } ──────────────────  |
         |                                      |
  QR-Code / Deep Link (openid-credential-offer://)|
  Polling: GET /issuer/result/:id               |
         |                                      |
  Wallet ──GET /issuer/offer/:id───────────>    |  Credential Offer JSON (pre-auth code)
  Wallet ──GET /.well-known/openid-credential-issuer──>  |  Issuer Metadata
  Wallet ──GET /.well-known/oauth-authorization-server──>|  Auth Server Metadata
  Wallet ──POST /issuer/token──────────────>    |  pre-auth code → access_token + c_nonce
  Wallet ──POST /issuer/credential─────────>    |  proof-of-possession → SD-JWT-VC
         |                                      |
         |<── { status: issued } ─────────────  |  polling erkennt Ausstellung
         |                                      |
  Schritt 4: Erfolg anzeigen
```

---

## Dateistruktur

### `eudi-wallet-service/`

```
eudi-wallet-service/
├── src/
│   ├── index.ts                – Hono Server, Route-Registrierung, CORS, /done/:sessionId, Trust List Startup
│   ├── routes/
│   │   ├── initiate.ts         – POST /initiate: Session erstellen, walletUrl zurückgeben
│   │   ├── request.ts          – GET /request/:sessionId: signierten JAR liefern
│   │   ├── callback.ts         – POST /callback/:sessionId: VP Token empfangen & validieren
│   │   └── result.ts           – GET /result/:sessionId: PID-Claims abrufen (polling)
│   │   └── issuer/             – OpenID4VCI Issuer-Endpunkte
│   │       ├── metadata.ts     – GET /.well-known/openid-credential-issuer + oauth-authorization-server
│   │       ├── initiate.ts     – POST /issuer/initiate: VP-Session + Issuance-Session erstellen
│   │       ├── pid-callback.ts – POST /issuer/link-pid: PID-Claims zur Issuance-Session verknüpfen
│   │       ├── offer.ts        – POST /issuer/create-offer/:id + GET /issuer/offer/:id
│   │       ├── token.ts        – POST /issuer/token: pre-auth code → access_token
│   │       ├── credential.ts   – POST /issuer/credential: proof-of-possession → SD-JWT-VC
│   │       ├── nonce.ts        – POST /issuer/nonce: frischen c_nonce liefern
│   │       └── result.ts       – GET /issuer/result/:id: Frontend-Polling für Issuance-Status
│   ├── lib/
│   │   ├── session.ts          – In-Memory Session Store (Map<sessionId, SessionState>)
│   │   ├── issuance-session.ts – In-Memory Issuance Session Store (Map)
│   │   ├── credential-builder.ts – SD-JWT-VC Credential erstellen (@sd-jwt/core)
│   │   ├── jar.ts              – JAR (JWT Authorization Request) erstellen & signieren
│   │   ├── validator.ts        – VP Token validieren (7 Schichten)
│   │   ├── pid.ts              – PID-Claims aus SD-JWT extrahieren
│   │   └── trustlist.ts        – Trust Lists von EUDI Sandbox laden (beim Start)
│   └── types.ts                – TypeScript Interfaces
├── scripts/
│   └── generate-keys.ts        – Einmalig: P-256 Keypair generieren → Public Key für Sandbox
├── package.json
├── tsconfig.json
├── railway.toml                – Railway Healthcheck-Konfiguration
└── .env.example                – Vorlage für Umgebungsvariablen
```

### `web/src/components/bewerbung/` (neue/geänderte Dateien)

```
EudiWalletButton.tsx    – Button-Komponente mit QR/Deep Link Logik + Polling + EUDIW Logo
StepPersonalInfo.tsx    – GEÄNDERT: EudiWalletButton integriert, VerifiedBadge auf Vorname/Nachname
StepContactInfo.tsx     – GEÄNDERT: VerifiedBadge auf Straße/PLZ/Stadt, streetQuery-Sync-Fix
StepHousehold.tsx       – GEÄNDERT: VerifiedBadge auf Geburtsdatum
types.ts                – PidClaims Interface (shared zwischen Komponenten)
```

### `web/src/app/bewerbung/`

```
page.tsx                – GEÄNDERT: walletVerifiedFields als Top-Level-State, an alle Steps weitergereicht
```

### `web/src/components/ui/`

```
DateInput.tsx           – GEÄNDERT: label-Prop von string auf React.ReactNode (für Badge-JSX)
```

### `web/src/app/ausstellen/` (Credential-Ausstellung)

```
page.tsx                       – Landing: Credential-Typ auswählen (2 Karten)
[type]/page.tsx                – Multi-Step-Flow: verify → preview → issue → success
```

### `web/src/components/ausstellen/`

```
types.ts                       – CredentialType, Mock-Claim Configs, PidClaims
PidVerificationStep.tsx        – PID-Verifizierung (QR/Deep Link, pollt /issuer/result/:id)
CredentialPreview.tsx          – Credential-Vorschau (PID-Felder + Mock-Felder mit Badges)
IssuanceWalletButton.tsx       – Credential Offer QR/Deep Link (openid-credential-offer://)
```

---

## Endpunkte des Services

### `POST /initiate`
Erstellt eine neue Session.

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "walletUrl": "openid4vp://?client_id=DE.9844...&request_uri=https://railway-url/request/uuid"
}
```

### `GET /request/:sessionId`
Wallet-App ruft diesen Endpunkt ab, um den signierten JAR zu erhalten.

**Response:** `Content-Type: application/oauth-authz-req+jwt`
Body: kompakter JWT (signiert mit Access Certificate Private Key, `x5c` Header)

**JAR enthält:**
- DCQL Query: fordert given_name, family_name, birthdate, address (street, postal, locality) an
- `response_uri`: wohin die Wallet die VP Token schicken soll
- `nonce`: Session-Binding
- `client_metadata.jwks`: ephemeral public key für JWE-Verschlüsselung der Antwort
- Signed with `ES256`, `typ: oauth-authz-req+jwt`, `x5c` cert chain

### `POST /callback/:sessionId`
Wallet-App schickt den VP Token hierhin.

**Input:** `application/x-www-form-urlencoded` mit `response`-Feld (JWE) oder JSON mit `vp_token`

**Validierung (7 Schichten in `validator.ts`):**
1. Transport: Struktur, Größe
2. Session Binding: Nonce, Audience, Timestamps
3. Credential Assurance: Issuer-Signatur, Trust List
4. Holder Binding: Key Binding JWT (KB-JWT), Nonce-Check
5. Wallet Integrity: Wallet Attestation gegen Trust List
6. Selective Disclosure: Disclosures vorhanden
7. Business Rules: Felder nicht leer, Datumsformat

**Response:** `{ redirect_uri: "https://service-url/done/:sessionId" }`
Die Wallet-App lädt diese URL → zeigt statische Erfolgsseite ("Authentifizierung abgeschlossen"). Kein Redirect zurück zum Frontend.

### `GET /done/:sessionId`
Wird vom Wallet-Browser nach Präsentation geöffnet. Verhalten je nach Flow:

- **Same-Device:** Falls ein `returnUrl` für die Session gesetzt ist (d.h. Mobile hat `returnUrl` beim `/initiate` mitgeschickt) → `window.close()` im `<head>` der Seite schließt den Tab sofort → der Bewerbungs-Tab kommt wieder in den Vordergrund.
- **Cross-Device:** Kein `returnUrl` → statische grüne Erfolgsseite ("Ihre Daten wurden erfolgreich übertragen. Sie können dieses Fenster schließen.")

**Technischer Hintergrund:** `returnUrl` wird in einer separaten `returnUrls`-Map (mit 15-min TTL) gespeichert, die unabhängig vom Session-Lifecycle ist. So überlebt sie auch, wenn das Frontend-Polling `/result/` bereits die Session gelöscht hat.

### `GET /result/:sessionId`
Frontend pollt diesen Endpunkt alle 2 Sekunden.

**Response:**
- `202` + `{ status: "pending" }` – Wallet hat noch nicht geantwortet
- `200` + `{ status: "complete", pidClaims: {...} }` – fertig, Claims zurückgeben
- `400` + `{ status: "error", errorMessage: "..." }` – Validierung fehlgeschlagen

Nach Abruf wird die Session gelöscht.

---

## Endpunkte – OpenID4VCI Issuer

### `GET /.well-known/openid-credential-issuer`
Issuer Metadata gemäß OpenID4VCI. Beschreibt unterstützte Credential-Typen, Formate und Endpunkte.

**Response:**
```json
{
  "credential_issuer": "https://fe-poc-production.up.railway.app",
  "credential_endpoint": "https://fe-poc-production.up.railway.app/issuer/credential",
  "nonce_endpoint": "https://fe-poc-production.up.railway.app/issuer/nonce",
  "credential_configurations_supported": {
    "wohnungsgeberbestaetigung": {
      "format": "vc+sd-jwt",
      "vct": "urn:credential:wohnungsgeberbestaetigung:1",
      "claims": { "..." }
    },
    "genossenschaft-mitglied": {
      "format": "vc+sd-jwt",
      "vct": "urn:credential:genossenschaft-mitglied:1",
      "claims": { "..." }
    }
  }
}
```

### `GET /.well-known/oauth-authorization-server`
OAuth 2.0 Authorization Server Metadata. Beschreibt den Token-Endpunkt und unterstützte Grant-Typen.

**Response:**
```json
{
  "issuer": "https://fe-poc-production.up.railway.app",
  "token_endpoint": "https://fe-poc-production.up.railway.app/issuer/token",
  "grant_types_supported": ["urn:ietf:params:oauth:grant-type:pre-authorized_code"]
}
```

### `POST /issuer/initiate`
Erstellt eine neue Issuance-Session und eine verknüpfte VP-Session (für PID-Verifizierung).

**Request:**
```json
{
  "credentialType": "wohnungsgeberbestaetigung" | "genossenschaft-mitglied",
  "returnUrl": "http://localhost:3000"  // optional, nur Mobile
}
```

**Response:**
```json
{
  "sessionId": "issuance-session-uuid",
  "vpSessionId": "vp-session-uuid",
  "walletUrl": "openid4vp://?client_id=...&request_uri=https://railway-url/request/vp-session-uuid"
}
```

### `POST /issuer/link-pid`
Verknüpft PID-Claims aus einer abgeschlossenen VP-Session mit einer Issuance-Session. (Wird im aktuellen Flow nicht mehr direkt aufgerufen – Callback auto-linked automatisch.)

**Request:**
```json
{
  "issuanceSessionId": "issuance-session-uuid",
  "vpSessionId": "vp-session-uuid"
}
```

**Response:**
```json
{
  "status": "pid_verified",
  "pidClaims": { "given_name": "...", "family_name": "...", "birthdate": "..." }
}
```

### `POST /issuer/create-offer/:sessionId`
Erstellt ein Credential Offer für die Issuance-Session. Setzt den Status auf `offer_created`.

**Response:**
```json
{
  "walletUrl": "openid-credential-offer://?credential_offer_uri=https://railway-url/issuer/offer/session-uuid"
}
```

### `GET /issuer/offer/:sessionId`
Liefert das Credential Offer JSON (wird von der Wallet abgerufen).

**Response:**
```json
{
  "credential_issuer": "https://fe-poc-production.up.railway.app",
  "credential_configuration_ids": ["wohnungsgeberbestaetigung"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "base64url-random-32-bytes"
    }
  }
}
```

### `POST /issuer/token`
Token-Endpunkt: tauscht Pre-Authorized Code gegen Access Token + c_nonce.

**Request:** `application/x-www-form-urlencoded`
```
grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=base64url-random-32-bytes
```

**Response:**
```json
{
  "access_token": "random-access-token",
  "token_type": "Bearer",
  "expires_in": 900,
  "c_nonce": "random-c-nonce",
  "c_nonce_expires_in": 300
}
```

### `POST /issuer/credential`
Credential-Endpunkt: Nimmt Proof-of-Possession entgegen, erstellt und liefert SD-JWT-VC.

**Request:**
```json
{
  "credential_identifier": "wohnungsgeberbestaetigung",
  "proof": {
    "proof_type": "jwt",
    "jwt": "eyJ..."
  }
}
```

**Response:**
```json
{
  "credential": "eyJ...~disclosure1~disclosure2~",
  "c_nonce": "new-c-nonce",
  "c_nonce_expires_in": 300
}
```

### `POST /issuer/nonce`
Liefert einen frischen c_nonce (falls der vorherige abgelaufen ist).

**Response:**
```json
{
  "c_nonce": "fresh-c-nonce",
  "c_nonce_expires_in": 300
}
```

### `GET /issuer/result/:sessionId`
Frontend pollt diesen Endpunkt für den Issuance-Status.

**Response:**
- `202` + `{ status: "pending_pid" }` – wartet auf PID-Verifizierung
- `200` + `{ status: "pid_verified", pidClaims: {...} }` – PID verifiziert, bereit für Vorschau
- `200` + `{ status: "offer_created" }` – Credential Offer erstellt, wartet auf Wallet
- `200` + `{ status: "issued" }` – Credential erfolgreich ausgestellt
- `400` + `{ status: "error", errorMessage: "..." }` – Fehler

---

## Session State

```typescript
interface SessionState {
  nonce: string                    // zufällig, base64url, 32 bytes
  ephemeralPrivateKey: CryptoKey   // für JWE-Entschlüsselung der Wallet-Antwort
  ephemeralPublicKeyJwk: JWK       // im JAR an Wallet gesendet
  createdAt: number                // Unix ms
  expiresAt: number                // createdAt + 10 Minuten
  status: 'pending' | 'complete' | 'error'
  pidClaims?: PidClaims            // gesetzt wenn complete
  errorMessage?: string            // gesetzt wenn error
}
```

Sessions werden im RAM gespeichert (Map). Alle 5 Minuten werden abgelaufene Sessions bereinigt. Für Prod: Redis verwenden.

**Separate `returnUrls`-Map:** `returnUrl` (mobile Rückkehr-URL) wird in einer eigenen `Map<sessionId, string>` gespeichert, die sich automatisch nach 15 Minuten bereinigt. Dadurch überlebt die `returnUrl` die Session-Löschung durch `/result/` – `/done/` kann sie auch dann noch lesen, wenn das Frontend die Session bereits abgeholt hat.

**Verknüpfung VP ↔ Issuance:** `SessionState` hat jetzt ein optionales `issuanceSessionId`-Feld. Wenn eine VP-Session im Rahmen einer Issuance erstellt wurde, wird die `issuanceSessionId` gesetzt. Der Callback erkennt dies und überträgt die PID-Claims automatisch in die Issuance-Session.

### IssuanceSessionState

```typescript
interface IssuanceSessionState {
  credentialType: CredentialType         // 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'
  preAuthorizedCode: string              // zufällig, base64url, 32 bytes
  accessToken?: string                   // gesetzt nach Token-Exchange
  cNonce?: string                        // gesetzt nach Token-Exchange
  cNonceExpiresAt?: number               // cNonce Ablaufzeit (Unix ms)
  pidClaims?: PidClaims                  // gesetzt nach PID-Verifikation
  holderPublicKeyJwk?: JWK              // gesetzt nach Credential-Ausstellung
  createdAt: number                      // Unix ms
  expiresAt: number                      // createdAt + 15 Minuten
  status: 'pending_pid' | 'pid_verified' | 'offer_created' | 'issued' | 'error'
  errorMessage?: string
}
```

Issuance-Sessions werden ebenfalls im RAM gespeichert (`issuance-session.ts`). Gleicher Cleanup-Mechanismus wie VP-Sessions.

---

## PID-Claims → Formular-Mapping

```typescript
// PID                      → Formularfeld (useApplicationForm)     → Schritt
given_name               → firstname          (StepPersonalInfo)   → Schritt 2
family_name              → lastname           (StepPersonalInfo)   → Schritt 2
birthdate                → dateOfBirth        (StepHousehold)      → Schritt 4
address.street_address   → street             (StepContactInfo)    → Schritt 3
address.postal_code      → zipCode            (StepContactInfo)    → Schritt 3
address.locality         → city               (StepContactInfo)    → Schritt 3
```

**Hinweis:** Das SPRIND-Demo-PID enthält keine Adressdaten. `firstname`, `lastname` und `birthdate` werden immer befüllt.

`walletVerifiedFields` (ein `Set<string>`) wird in `page.tsx` als Top-Level-State gehalten und an alle Steps weitergereicht. So überleben die Badge-Markierungen den Wechsel zwischen Schritten.

---

## Credential-Typen (Issuance)

### Wohnungsgeberbestätigung

**VCT:** `urn:credential:wohnungsgeberbestaetigung:1`

| Feld | Quelle | Wert |
|------|--------|------|
| `given_name` | Aus PID | (vom Wallet) |
| `family_name` | Aus PID | (vom Wallet) |
| `birthdate` | Aus PID | (vom Wallet) |
| `street_address` | Mock | `"Musterstraße 42"` |
| `postal_code` | Mock | `"10115"` |
| `locality` | Mock | `"Berlin"` |
| `move_in_date` | Mock | `"2026-04-01"` |
| `landlord_name` | Mock | `"Immobilien GmbH"` |

### Genossenschafts-Mitgliedsbescheinigung

**VCT:** `urn:credential:genossenschaft-mitglied:1`

| Feld | Quelle | Wert |
|------|--------|------|
| `given_name` | Aus PID | (vom Wallet) |
| `family_name` | Aus PID | (vom Wallet) |
| `birthdate` | Aus PID | (vom Wallet) |
| `cooperative_name` | Mock | `"Berliner Wohnungsbaugenossenschaft eG"` |
| `membership_number` | Mock | `"BWG-2026-04217"` |
| `member_since` | Mock | `"2026-03-15"` |

---

## Umgebungsvariablen

### `eudi-wallet-service/` (gesetzt in Railway Dashboard)

| Variable | Beschreibung |
|----------|-------------|
| `PRIVATE_KEY` | PEM Private Key des Access Certificates (ES256, P-256) |
| `CERT_CHAIN` | PEM Certificate Chain vom EUDI Sandbox (Leaf + Intermediate CA!) |
| `CLIENT_ID` | Nicht mehr als eigene Env-Variable nötig – wird automatisch via `computeClientId()` aus `CERT_CHAIN` berechnet (`x509_hash:<base64url(sha256(leaf_cert_DER))>`) |
| `SERVICE_URL` | Öffentliche Railway-URL (z.B. `https://fe-poc-production.up.railway.app`) |
| `FRONTEND_URL` | Frontend-URL – wird im JAR als Teil der `redirect_uri` Konfiguration verwendet |
| `ALLOWED_ORIGINS` | CORS-Whitelist – steuert welche Frontend-Ursprünge den Service aufrufen dürfen (kommagetrennt, z.B. `http://localhost:3000,https://meine-app.vercel.app`) |
| `TRUST_LIST_URL` | `https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/` |
| `PORT` | Wird von Railway gesetzt (8080) – NICHT manuell setzen |

**Wichtig:** `PRIVATE_KEY` gehört NUR in Railway. Nie in `web/.env.local` oder Git!

### `web/.env.local`

```env
NEXT_PUBLIC_EUDI_SERVICE_URL=https://fe-poc-production.up.railway.app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Deployment (Railway)

**Service URL:** `https://fe-poc-production.up.railway.app`

**Konfiguration:**
- Root Directory in Railway: `eudi-wallet-service`
- Start Command: `npm start` → führt `tsx src/index.ts` aus
- `railway.toml` im Ordner: Health Check auf `/health`, Timeout 60s
- Port: Railway setzt `PORT=8080` automatisch – Service liest `process.env.PORT`

**Domain-Routing in Railway:**
- Railway Networking: Domain → Port **8080** (muss mit `PORT` übereinstimmen!)
- Falls 502-Fehler: Prüfen ob Domain-Port und `PORT` env var übereinstimmen

**Deploy auslösen:** Git push auf `main` → Railway deployed automatisch

---

## Frontend-Komponente (`EudiWalletButton.tsx`)

### UI

- **Idle-State:** EUDIW-Logo (offiziell von interoperable-europe.ec.europa.eu) über dem Button, darunter Button mit Wallet-Icon + Text "Mit EU Digital Identity Wallet ausfüllen"
- **Alle anderen States:** Button-/Container-Varianten ohne Logo

### Zustände (Flow State Machine)

```
idle → loading → polling → success
                         ↘ error
     (Desktop und Mobile: kein "ready" – sofort polling)
```

- **idle:** EUDIW Logo + Button "Mit EU Digital Identity Wallet ausfüllen"
- **loading:** Ruft `POST /initiate` auf; Mobile öffnet gleichzeitig `window.location.href = walletUrl`
- **polling (Desktop):** Sofort nach `POST /initiate` – zeigt QR-Code + Spinner
- **polling (Mobile):** Sofort nach `window.location.href = walletUrl` – zeigt Spinner ("Warte auf Freigabe in der Wallet...")
- **success:** Grünes Banner, `onPidReceived()` wird aufgerufen
- **error:** Rotes Banner mit Retry-Option

*Hinweis:* Der `ready`-Zustand existiert noch als TypeScript-Typ, wird aber nicht mehr erreicht – er ist totes Codepfad-Relikt.

### Same-Device Rückkehr

1. Mobile sendet beim `/initiate`-Aufruf `returnUrl: window.location.origin` (z.B. `http://192.168.1.100:3000`)
2. Service speichert diese URL in der separaten `returnUrls`-Map
3. Nach Wallet-Präsentation öffnet die Wallet die `redirect_uri` → `/done/:sessionId`
4. Der Service prüft: `!!getReturnUrl(sessionId)` → falls `true` (same-device): HTML-Seite mit `window.close()` in `<head>` → Tab schließt sich sofort → Bewerbungs-Tab kommt in den Vordergrund
5. Das Frontend erkennt den Abschluss über Polling (`GET /result/:id`) – nicht über URL-Parameter

*Fallback:* Der `wallet_session` URL-Parameter-Mechanismus ist im Code noch vorhanden (`useEffect` in `EudiWalletButton.tsx`), wird im aktuellen Flow aber nicht genutzt.

---

## "Aus Wallet" Badges

`VerifiedBadge` (exportiert aus `EudiWalletButton.tsx`) – kleines grünes Häkchen + "Aus Wallet".

Wird in Feld-Labels eingebettet (alle Labels akzeptieren `React.ReactNode`):

| Feld | Schritt | Komponente |
|------|---------|------------|
| Vorname | 2 | StepPersonalInfo |
| Nachname | 2 | StepPersonalInfo |
| Geburtsdatum | 4 | StepHousehold (`DateInput` label) |
| Straße | 3 | StepContactInfo |
| PLZ | 3 | StepContactInfo |
| Stadt | 3 | StepContactInfo |

---

## Behobene Bugs (vollständige Liste)

### 1. Railway 502 durch Port-Mismatch
**Problem:** Railway Domain war auf Port 3001 konfiguriert, `PORT` env war 8080.
**Symptom:** Health Check intern OK, extern 502 mit leerem `upstreamAddress`.
**Fix:** In Railway Networking → Domain Port auf 8080 ändern (muss mit `PORT` env übereinstimmen).

### 2. jose v6: falsche Key-Generierung
**Problem:** `generateKeyPair('EC', { crv: 'P-256' })` – jose v6 akzeptiert keinen Key-Typ `'EC'`.
**Fix:** `generateKeyPair('ECDH-ES', { extractable: true })` – jose v6 nimmt den Algorithmus als String.

### 3. Session-Speicherung mit falschem Schlüssel
**Problem:** `createSession({ nonce: sessionId, ... })` – Session-Map nutzte `nonce` als Key, aber Lookup war nach `sessionId`.
**Fix:** `createSession(sessionId, state)` – `sessionId` und `state` getrennt übergeben. Session-Map key = sessionId. Actual random `nonce` in `state.nonce` gespeichert.

### 4. tsx in devDependencies
**Problem:** Railway prunet devDependencies in Production → `tsx` nicht gefunden → Server startet nicht.
**Fix:** `tsx` in `dependencies` verschoben (nicht `devDependencies`).

### 5. Unvollständige CERT_CHAIN (fehlende Intermediate CA)
**Problem:** `CERT_CHAIN` enthielt nur das Leaf-Zertifikat. Wallet konnte die Zertifikatskette nicht aufbauen → `invalidClientMetadata`.
**Fix:** Intermediate CA (German Registrar) von `https://sandbox.eudi-wallet.org/api/ca` holen und in `CERT_CHAIN` anhängen (beide PEM-Blöcke hintereinander).

### 6. Fehlende `kid` im ephemeral JWK
**Problem:** EUDI Wallet filtert JWK-Keys heraus, bei denen `kid` oder `alg` leer ist. Der ephemeral Public Key hatte kein `kid` → `responseEncryptionSpecification: nil` → `invalidClientMetadata`.
**Fix:** In `initiate.ts`: `ephemeralPublicKeyJwk.kid = randomUUID()` + `ephemeralPublicKeyJwk.alg = 'ECDH-ES'` setzen.

### 7. Falsche `client_metadata` Feldnamen
**Problem:** Wallet liest spezifische Felder (aus `ClientMetaData.swift`). Falsche Namen werden ignoriert.
- `vp_formats` → muss `vp_formats_supported` heißen
- `authorization_encrypted_response_alg/enc` → werden NICHT gelesen; stattdessen `encrypted_response_enc_values_supported`
**Fix:** Exakte Feldnamen laut Swift-Sourcecode verwenden.

### 8. `birth_date` vs `birthdate` im DCQL (Service)
**Problem:** DCQL-Query forderte `birth_date` (eIDAS ARF Schreibweise). SPRIND Sandbox PID verwendet jedoch `birthdate` (OIDC Core Standard) → `Claim not found: birth_date` → `credential_set cannot be satisfied`.
**Fix:** In `jar.ts`: `{ path: ['birthdate'] }` statt `{ path: ['birth_date'] }`.

### 9. `birth_date` vs `birthdate` im Frontend-Mapping (Frontend)
**Problem:** `page.tsx` las `claims.birth_date` → `dateOfBirth` wurde nie gesetzt, Geburtsdatum blieb leer.
**Fix:** `claims.birthdate` (OIDC Standard, konsistent mit Service und `types.ts`).

### 10. Handy-Weißseite nach Wallet-Präsentation
**Problem:** `POST /callback` antwortete mit `redirect_uri: "http://localhost:3000/bewerbung?wallet_session=..."`. Wallet-Browser auf dem Handy öffnete localhost → "Connection refused" → weiße Seite.
**Fix:** `/done/:sessionId` Endpunkt auf dem Service selbst hinzugefügt. `callback.ts` gibt nun `redirect_uri: "https://service-url/done/:sessionId"` zurück. Die statische Erfolgsseite zeigt eine Bestätigung ohne JS-Redirect.

### 11. Desktop-Polling startete nicht automatisch
**Problem:** Nach `POST /initiate` wurde der Status `ready` gesetzt und QR angezeigt, Polling startete aber erst nach manuellem Button-Klick ("Ich habe den QR-Code gescannt" o.ä.).
**Fix:** Desktop-Pfad in `handleStart()` ruft direkt `startPolling()` statt `setFlow({ status: 'ready' })`. Nur Mobile behält den "ready"-Zustand mit dem "Wallet öffnen" Button.

### 12. `walletVerifiedFields` überlebt Schrittwechsel nicht
**Problem:** `walletVerifiedFields` war lokaler State in `StepPersonalInfo`. Beim Wechsel zu Schritt 3 wurde die Komponente unmounted → State verloren → in Schritt 3/4 keine Badges.
**Fix:** `walletVerifiedFields` als `useState<Set<string>>` in `page.tsx` (Top-Level) gehoben. Wird an `StepPersonalInfo`, `StepContactInfo` und `StepHousehold` als Prop weitergereicht.

### 13. `handlePidReceived is not defined` (ReferenceError)
**Problem:** Beim Refactoring (State aus `StepPersonalInfo` herausgehoben) wurde die lokale Hilfsfunktion `handlePidReceived` entfernt, aber der JSX-Verweis `onPidReceived={handlePidReceived}` blieb stehen.
**Fix:** JSX-Verweis auf die Prop geändert: `onPidReceived={onPidReceived}`.

### 14. `streetQuery` synchronisiert sich nicht bei Wallet-Befüllung
**Problem:** `StepContactInfo` hält einen lokalen `streetQuery`-State für das Straßen-Eingabefeld (Autocomplete). Der wird beim Mount mit dem `street`-Prop initialisiert, aber wenn die Wallet nachträglich `street` setzt, blieb `streetQuery` veraltet → Straße wurde nicht im Feld angezeigt.
**Fix:** `useEffect(() => setStreetQuery(street), [street])` in `StepContactInfo`.

### 15. Same-Device: Erfolgsseite öffnete in neuem Tab, Bewerbungs-Tab blieb im Hintergrund
**Problem:** Nach Wallet-Präsentation öffnete die Wallet die `redirect_uri` in einem neuen Safari-Tab. User sah eine Erfolgsseite, musste den Tab manuell schließen um zurück zur Bewerbung zu kommen.
**Fix:** `/done/:sessionId` gibt für same-device eine HTML-Seite mit `<script>window.close();</script>` im `<head>` zurück. Das Script läuft bevor die Seite gerendert wird → Tab schließt sich sofort → Bewerbungs-Tab kommt in den Vordergrund.

### 16. Cross-Device: Handy wurde auf localhost weitergeleitet
**Problem:** Desktop sendete `returnUrl: window.location.origin = "http://localhost:3000"` beim `/initiate`-Aufruf. Das Handy (das die Wallet bedient) öffnete `/done/` → Service redirectete auf localhost → Handy konnte localhost nicht erreichen → weiße "Connection refused"-Seite.
**Fix:** `returnUrl` wird nur auf Mobile-Geräten mitgesendet (`isMobileDevice()` Check vor dem Fetch-Body). Desktop sendet kein `returnUrl`.

### 17. Race Condition: Session gelöscht bevor `/done/` returnUrl lesen konnte
**Problem:** Frontend pollt `/result/` alle 2s. Sobald Polling die complete-Session findet, löscht `deleteSession()` sie. Falls `/done/` danach aufgerufen wird (Wallet öffnet URL erst nach Polling), ist `session?.returnUrl` undefined → kein Redirect/close.
**Fix:** `returnUrl` in eine separate `returnUrls`-Map ausgelagert (mit eigenem 15-min TTL), vollständig unabhängig vom Session-Lifecycle. `getReturnUrl(sessionId)` funktioniert auch noch lange nach `deleteSession()`.

### 18. Redundanter "Wallet öffnen" Button auf Mobile
**Problem:** Nach Klick auf "Mit EU Digital Identity Wallet ausfüllen" erschien auf Mobile ein zweiter Button "Wallet öffnen" (der `ready`-Zustand). Zwei Klicks für eine Aktion ist schlechte UX.
**Fix:** In `handleStart()` öffnet Mobile direkt `window.location.href = data.walletUrl` und ruft sofort `startPolling()` auf. Der `ready`-Zustand wird nicht mehr gesetzt (ist Dead Code).

### 19. Race Condition: VP-Session gelöscht bevor link-pid sie lesen konnte
**Problem:** Frontend pollt `GET /result/:vpSessionId` → VP-Ergebnis wird zurückgegeben und Session gelöscht. Danach ruft Frontend `POST /issuer/link-pid` mit `vpSessionId` auf → "VP session not found" (Session bereits gelöscht).
**Fix:** Callback auto-linked PID zur Issuance-Session. VP-Session speichert `issuanceSessionId`. Wenn Callback PID erfolgreich extrahiert und `issuanceSessionId` vorhanden ist, werden die PID-Claims automatisch in die Issuance-Session übertragen. Frontend pollt jetzt `GET /issuer/result/:issuanceSessionId` (wartet auf `pid_verified` Status) statt über den VP-Result-Endpunkt + link-pid Zwei-Schritt-Prozess.

---

## Aktueller Stand (März 2026)

### ✅ Erledigt
- [x] `eudi-wallet-service/` vollständig implementiert (alle 4 Routes + `/done/`, 7-Layer-Validator, PID-Extraktion)
- [x] Service auf Railway deployed und läuft stabil
- [x] `/health` → 200 ✓
- [x] `POST /initiate` → `{ sessionId, walletUrl }` ✓
- [x] `GET /request/:id` → signierter JAR JWT ✓
- [x] `POST /callback/:id` → VP Token validiert, PID extrahiert ✓
- [x] `GET /result/:id` → PID-Claims zurückgegeben ✓
- [x] **End-to-End erfolgreich getestet** – Vorname, Nachname, Geburtsdatum ins Formular übernommen ✓
- [x] `EudiWalletButton.tsx` implementiert (QR + Deep Link + automatisches Polling)
- [x] EUDIW Logo über dem Button (offiziell, h-16)
- [x] `StepPersonalInfo.tsx`: Button integriert, Badges auf Vorname/Nachname
- [x] `StepHousehold.tsx`: Badge auf Geburtsdatum
- [x] `StepContactInfo.tsx`: Badges auf Straße/PLZ/Stadt, streetQuery-Sync
- [x] `DateInput.tsx`: label als `React.ReactNode`
- [x] `walletVerifiedFields` in `page.tsx` (Top-Level, persistiert zwischen Schritten)
- [x] `PRIVATE_KEY` aus `web/.env.local` entfernt (Sicherheit)
- [x] `CERT_CHAIN` mit Intermediate CA (German Registrar) ergänzt
- [x] Handy zeigt nach Wallet-Präsentation korrekte Erfolgsseite (kein localhost-Redirect)
- [x] **Same-Device Flow** erfolgreich getestet (lokale IP-Adresse des Macs, kein ngrok nötig)
- [x] Same-Device: `window.close()` schließt Wallet-Tab sofort → Bewerbungs-Tab kommt in den Vordergrund ✓
- [x] Same-Device: Kein redundanter "Wallet öffnen" Button – Wallet öffnet direkt beim ersten Klick ✓
- [x] `returnUrls`-Map mit eigenem 15-min TTL (Race-Condition-fix: unabhängig von Session-Lifecycle)
- [x] "Neu starten" Button im Header – setzt Formular, Wallet-Badges und Schritt zurück
- [x] **OpenID4VCI Credential Issuance** implementiert (Pre-Authorized Code Flow)
- [x] Zwei Credential-Typen: Wohnungsgeberbestätigung + Genossenschafts-Mitgliedsbescheinigung
- [x] SD-JWT-VC Credential Builder (`@sd-jwt/core`)
- [x] Issuer Metadata (`.well-known/openid-credential-issuer` + `oauth-authorization-server`)
- [x] Token Endpoint (Pre-Authorized Code → access_token + c_nonce)
- [x] Credential Endpoint (proof-of-possession → SD-JWT-VC)
- [x] Frontend: `/ausstellen` Landing + `/ausstellen/[type]` Multi-Step-Flow
- [x] PID-Verifikation → Credential-Vorschau → QR/Deep Link → Issuance
- [x] Race Condition fix: Callback auto-links PID zu Issuance-Session

### ⏳ Noch ausstehend / nice-to-have
- [ ] SPRIND Wallet Issuance-Support testen sobald nächstes Update veröffentlicht (v0.2.x)
- [ ] Eudiplo Referenz-Issuer als Format-Vergleich recherchieren
- [ ] Adressfelder testen sobald PID mit Adressdaten verfügbar
- [ ] `ready`-Zustand aus `EudiWalletButton.tsx` entfernen (Dead Code)
- [ ] Für Prod: Redis statt In-Memory Session Store

---

## Lokales Testen

```bash
# Terminal 1: EUDI Wallet Service (optional, Railway läuft bereits)
cd eudi-wallet-service
cp .env.example .env  # Werte eintragen
npm install
npm run dev           # startet auf localhost:3001

# Terminal 2: Frontend
cd web
npm run dev           # startet auf localhost:3000

# Browser – Bewerbungsformular:
# http://localhost:3000/bewerbung
# → Schritt "Persönliche Angaben"
# → EUDIW Logo + Button "Mit EU Digital Identity Wallet ausfüllen" → QR-Code erscheint
# → Mit SPRIND EUDI Wallet App scannen → Daten freigeben → Formular wird befüllt

# Browser – Credential-Ausstellung:
# http://localhost:3000/ausstellen
# → Credential-Typ auswählen → PID verifizieren → Vorschau → Ausstellung
```

**Service direkt testen:**
```bash
# Health
curl https://fe-poc-production.up.railway.app/health

# Neue Session
curl -X POST https://fe-poc-production.up.railway.app/initiate

# JAR abrufen (sessionId aus vorherigem Call)
curl https://fe-poc-production.up.railway.app/request/<sessionId>

# Issuer Metadata testen:
curl https://fe-poc-production.up.railway.app/.well-known/openid-credential-issuer
curl https://fe-poc-production.up.railway.app/.well-known/oauth-authorization-server
```

---

## EUDI Sandbox Setup (Referenz)

Falls Access Certificate neu erstellt werden muss:

1. Keys generieren: `npm run generate-keys` in `eudi-wallet-service/`
2. Public Key in EUDI Sandbox hochladen → Access Certificate erstellen
3. Certificate Chain (PEM, Leaf + Intermediate) → als `CERT_CHAIN` in Railway
4. Private Key (PEM) → als `PRIVATE_KEY` in Railway
5. `CLIENT_ID` wird automatisch berechnet (kein manuelles Setzen nötig)

**Intermediate CA holen:**
```bash
curl https://sandbox.eudi-wallet.org/api/ca
```
Diesen PEM-Block an das Leaf-Zertifikat anhängen (beide in `CERT_CHAIN`).

**Sandbox Trust List URL:**
`https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/`

**Registration Certificate (RC) – wichtige Felder:**
- Credential 1 (dc+sd-jwt): `address` → `given_name`, `family_name`, `birthdate`, `postal_code`
- Credential 2 (mso_mdoc): `eu.europa.ec.eudi.pid.1` → gleiche Felder (optional)
- Privacy Policy URL: echte Immomio-URL (nicht example.com)
- Purpose (DE): "Um Ihre Bewerbung auf eine Wohnung zu vervollständigen"
