# EUDI Wallet Integration – Projektdokumentation

> **Stand:** Februar 2026
> **Zweck:** Diese Datei dokumentiert alles, was gebaut wurde, warum, wie es funktioniert und wo wir im Prozess stehen. Zum schnellen Wiedereinstieg nach einer längeren Pause.

---

## Was wird gebaut?

Immomio POC – eine Wohnungsbewerber-App mit 5-Schritt-Formular. Schritt 2 ist "Persönliche Angaben" (Vorname, Nachname). Ziel: Nutzer können ihre persönlichen Daten **automatisch aus einem EU Digital Identity Wallet** (EUDI Wallet) befüllen lassen, statt sie manuell einzutippen.

Die Daten kommen als **PID (Person Identification Data)** aus dem Wallet – kryptografisch signiert, verifiziert von einer staatlichen Stelle (in DE: Bundesdruckerei). Das schafft Vertrauen für den Vermieter.

**Protokoll:** OpenID for Verifiable Presentations (OpenID4VP), gemäß eIDAS 2.0 / ARF

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
  Mobile:  "Wallet öffnen" Deep Link            |
  starte polling...                             |
                                                |
  [User scannt QR / öffnet Deep Link]           |
  Wallet-App ──GET /request/:id──────────────>  |  liefert signierten JAR (JWT)
  Wallet-App ──POST /callback/:id────────────>  |  empfängt VP Token, validiert,
                                                |  speichert PID-Claims in Session
         |── GET /result/:id ─────────────────> |
         |<── { status, pidClaims } ─────────── |
         |                                      |
  Formularfelder befüllen
  "Aus Wallet" Badges anzeigen
```

**Zwei Flows:**
- **QR Code (Cross-Device):** Desktop zeigt QR, User scannt mit Wallet-App auf Handy
- **Deep Link (Same-Device):** Mobile öffnet `openid4vp://` URL direkt – Wallet wird geöffnet
- Frontend erkennt Gerät automatisch (User Agent)

---

## Dateistruktur

### `eudi-wallet-service/`

```
eudi-wallet-service/
├── src/
│   ├── index.ts                – Hono Server, Route-Registrierung, CORS, Trust List Startup
│   ├── routes/
│   │   ├── initiate.ts         – POST /initiate: Session erstellen, walletUrl zurückgeben
│   │   ├── request.ts          – GET /request/:sessionId: signierten JAR liefern
│   │   ├── callback.ts         – POST /callback/:sessionId: VP Token empfangen & validieren
│   │   └── result.ts           – GET /result/:sessionId: PID-Claims abrufen (polling)
│   ├── lib/
│   │   ├── session.ts          – In-Memory Session Store (Map<sessionId, SessionState>)
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
EudiWalletButton.tsx    – Button-Komponente mit QR/Deep Link Logik + Polling
StepPersonalInfo.tsx    – GEÄNDERT: EudiWalletButton integriert, VerifiedBadge auf Feldern
types.ts                – PidClaims Interface (shared zwischen Komponenten)
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

**Input:** `application/x-www-form-urlencoded` oder JSON mit `vp_token`

**Validierung (7 Schichten in `validator.ts`):**
1. Transport: Struktur, Größe
2. Session Binding: Nonce, Audience, Timestamps
3. Credential Assurance: Issuer-Signatur, Trust List
4. Holder Binding: Key Binding JWT (KB-JWT), Nonce-Check
5. Wallet Integrity: Wallet Attestation gegen Trust List
6. Selective Disclosure: Disclosures vorhanden
7. Business Rules: Felder nicht leer, Datumsformat

**Response:** `{ redirect_uri: "https://frontend/bewerbung?wallet_session=..." }`

### `GET /result/:sessionId`
Frontend pollt diesen Endpunkt alle 2 Sekunden.

**Response:**
- `202` + `{ status: "pending" }` – Wallet hat noch nicht geantwortet
- `200` + `{ status: "complete", pidClaims: {...} }` – fertig, Claims zurückgeben
- `400` + `{ status: "error", errorMessage: "..." }` – Validierung fehlgeschlagen

Nach Abruf wird die Session gelöscht.

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

---

## PID-Claims → Formular-Mapping

```typescript
// PID                      → Formularfeld (useApplicationForm)
given_name               → firstname          (StepPersonalInfo)
family_name              → lastname           (StepPersonalInfo)
birthdate                → dateOfBirth        (Step 4)  // OIDC-Standard, nicht "birth_date"
address.street_address   → street             (Step 3)
address.postal_code      → zipCode            (Step 3)
address.locality         → city               (Step 3)
```

Aktuell werden in `StepPersonalInfo.tsx` nur `firstname` und `lastname` mit "Aus Wallet" Badge markiert.

---

## Umgebungsvariablen

### `eudi-wallet-service/` (gesetzt in Railway Dashboard)

| Variable | Beschreibung |
|----------|-------------|
| `PRIVATE_KEY` | PEM Private Key des Access Certificates (ES256, P-256) |
| `CERT_CHAIN` | PEM Certificate Chain vom EUDI Sandbox |
| `CLIENT_ID` | Nicht mehr als eigene Env-Variable nötig – wird automatisch via `computeClientId()` aus `CERT_CHAIN` berechnet (`x509_hash:<base64url(sha256(leaf_cert_DER))>`) |
| `SERVICE_URL` | Öffentliche Railway-URL (z.B. `https://fe-poc-production.up.railway.app`) |
| `FRONTEND_URL` | Frontend-URL für redirect_uri nach Same-Device Flow |
| `ALLOWED_ORIGINS` | CORS-Origins (kommagetrennt, z.B. `http://localhost:3000`) |
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

Zustände (Flow State Machine):
```
idle → loading → ready (QR/Deep Link) → polling → success
                                                 ↘ error
```

- **idle:** Button "Mit EU Digital Identity Wallet ausfüllen"
- **loading:** Ruft `POST /initiate` auf
- **ready (Desktop):** QR-Code anzeigen (`qrcode.react` / `QRCodeSVG`)
- **ready (Mobile):** "Wallet öffnen" Button → `window.location.href = walletUrl`
- **polling:** Ruft alle 2s `GET /result/:id` auf, max 3 Minuten
- **success:** Grünes Banner, `onPidReceived()` wird aufgerufen
- **error:** Rotes Banner mit Retry-Option

Same-Device Rückkehr: Nach Wallet-Präsentation leitet die Wallet zur `redirect_uri` (`/bewerbung?wallet_session=ID`) weiter. Der `useEffect` in der Komponente erkennt den URL-Parameter und startet sofort Polling für die bestehende Session.

---

## Behobene Bugs (wichtig für die Zukunft)

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
**Problem:** Railway prunt devDependencies in Production → `tsx` nicht gefunden → Server startet nicht.
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

### 8. `birth_date` vs `birthdate` (DCQL Claim-Name)
**Problem:** DCQL-Query forderte `birth_date` (eIDAS ARF Schreibweise). SPRIND Sandbox PID verwendet jedoch `birthdate` (OIDC Core Standard) → `Claim not found: birth_date` → `credential_set cannot be satisfied`.
**Fix:** In `jar.ts`: `{ path: ['birthdate'] }` statt `{ path: ['birth_date'] }`.

---

## Aktueller Stand (Februar 2026)

### ✅ Erledigt
- [x] `eudi-wallet-service/` vollständig implementiert (alle 4 Routes, 7-Layer-Validator, PID-Extraktion)
- [x] Service auf Railway deployed und läuft stabil
- [x] `/health` → 200 ✓
- [x] `POST /initiate` → `{ sessionId, walletUrl }` ✓
- [x] `GET /request/:id` → signierter JAR JWT ✓ (Wallet fetched JAR erfolgreich bestätigt)
- [x] `EudiWalletButton.tsx` in Frontend implementiert
- [x] `StepPersonalInfo.tsx` integriert (Button + VerifiedBadge)
- [x] Umgebungsvariablen in Railway gesetzt (PRIVATE_KEY, CERT_CHAIN, etc.)
- [x] PRIVATE_KEY aus `web/.env.local` entfernt (Sicherheit)
- [x] CERT_CHAIN mit Intermediate CA (German Registrar) ergänzt
- [x] `kid` + `alg` im ephemeral JWK gesetzt (Wallet-Kompatibilität)
- [x] Korrekte `client_metadata` Feldnamen laut Swift-Source
- [x] `birthdate` statt `birth_date` im DCQL (OIDC-Standard)
- [x] Session Transcript wird von Wallet erfolgreich gebaut ✓

### ⏳ Noch ausstehend
- [ ] **MdocSecurity18013 Workaround:** German Registrar CA auf Test-iPhone installieren (Einstellungen → Allgemein → Info → Zertifikatvertrauenseinstellungen → aktivieren). Die CA liegt unter `https://sandbox.eudi-wallet.org/api/ca` — per AirDrop als `.crt` aufs Gerät bringen. Kann jederzeit wieder entfernt werden. Langfristig: SPRIND Wallet soll WRPAC Trust List nutzen (offener Issue).
- [ ] **End-to-End Test:** VP Token vom Wallet empfangen + validieren (`POST /callback`)
- [ ] Bei Bedarf: `redirect_uri` für Same-Device Flow mit Vercel-URL testen

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

# Browser:
# http://localhost:3000/bewerbung
# → Schritt "Persönliche Angaben"
# → Button "Mit EU Digital Identity Wallet ausfüllen" → QR-Code erscheint
```

**Service direkt testen:**
```bash
# Health
curl https://fe-poc-production.up.railway.app/health

# Neue Session
curl -X POST https://fe-poc-production.up.railway.app/initiate

# JAR abrufen (sessionId aus vorherigem Call)
curl https://fe-poc-production.up.railway.app/request/<sessionId>
```

---

## EUDI Sandbox Setup (Referenz)

Falls Access Certificate neu erstellt werden muss:

1. Keys generieren: `npm run generate-keys` in `eudi-wallet-service/`
2. Public Key in EUDI Sandbox hochladen → Access Certificate erstellen
3. Certificate Chain (PEM) → als `CERT_CHAIN` in Railway
4. Private Key (PEM) → als `PRIVATE_KEY` in Railway
5. `CLIENT_ID` = x509_san_dns aus dem Certificate

**Sandbox Trust List URL:**
`https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/`

**Registration Certificate (RC) – wichtige Felder:**
- Credential 1 (dc+sd-jwt): `address` → `given_name`, `family_name`, `birthdate`, `postal_code`
- Credential 2 (mso_mdoc): `eu.europa.ec.eudi.pid.1` → gleiche Felder (optional, da DCQL nur dc+sd-jwt anfordert)
- Privacy Policy URL: echte Immomio-URL (nicht example.com)
- Purpose (DE): "Um Ihre Bewerbung auf eine Wohnung zu vervollständigen"
