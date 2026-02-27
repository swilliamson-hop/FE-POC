# EUDI Wallet Integration – Projektdokumentation

> **Stand:** Februar 2026
> **Zweck:** Diese Datei dokumentiert alles, was gebaut wurde, warum, wie es funktioniert und wo wir im Prozess stehen. Zum schnellen Wiedereinstieg nach einer längeren Pause.

---

## Was wird gebaut?

Immomio POC – eine Wohnungsbewerber-App mit 5-Schritt-Formular. Ziel: Nutzer können ihre persönlichen Daten **automatisch aus einem EU Digital Identity Wallet** (EUDI Wallet) befüllen lassen, statt sie manuell einzutippen.

Die Daten kommen als **PID (Person Identification Data)** aus dem Wallet – kryptografisch signiert, verifiziert von einer staatlichen Stelle (in DE: Bundesdruckerei). Das schafft Vertrauen für den Vermieter.

**Protokoll:** OpenID for Verifiable Presentations (OpenID4VP), gemäß eIDAS 2.0 / ARF

**Status: ✅ End-to-End funktioniert** – Wallet-Präsentation wird erfolgreich empfangen, validiert und die PID-Daten werden ins Formular übernommen.

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
  Mobile:  "Wallet öffnen" Button               |
           → öffnet Deep Link                   |
           → startet polling                    |
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
- **Deep Link (Same-Device):** Mobile zeigt "Wallet öffnen" Button → Wallet wird geöffnet, User tippt auf Button, Polling startet danach.
- Frontend erkennt Gerät automatisch (User Agent).

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
Statische HTML-Seite (grüne Erfolgsmeldung). Wird vom Wallet-Browser nach Präsentation geöffnet.
**Wichtig:** Kein JS-Redirect – die Seite bleibt stehen, damit das Handy keine "Connection refused"-Seite sieht.

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

## Umgebungsvariablen

### `eudi-wallet-service/` (gesetzt in Railway Dashboard)

| Variable | Beschreibung |
|----------|-------------|
| `PRIVATE_KEY` | PEM Private Key des Access Certificates (ES256, P-256) |
| `CERT_CHAIN` | PEM Certificate Chain vom EUDI Sandbox (Leaf + Intermediate CA!) |
| `CLIENT_ID` | Nicht mehr als eigene Env-Variable nötig – wird automatisch via `computeClientId()` aus `CERT_CHAIN` berechnet (`x509_hash:<base64url(sha256(leaf_cert_DER))>`) |
| `SERVICE_URL` | Öffentliche Railway-URL (z.B. `https://fe-poc-production.up.railway.app`) |
| `FRONTEND_URL` | Frontend-URL (aktuell nicht mehr für Redirect genutzt, war Same-Device Rückkehr) |
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

### UI

- **Idle-State:** EUDIW-Logo (offiziell von interoperable-europe.ec.europa.eu) über dem Button, darunter Button mit Wallet-Icon + Text "Mit EU Digital Identity Wallet ausfüllen"
- **Alle anderen States:** Button-/Container-Varianten ohne Logo

### Zustände (Flow State Machine)

```
idle → loading → polling → success
                         ↘ error
     (Desktop: kein "ready" – sofort polling)

idle → loading → ready (Mobile: zeigt "Wallet öffnen" Button)
                      → polling → success
                                ↘ error
```

- **idle:** EUDIW Logo + Button "Mit EU Digital Identity Wallet ausfüllen"
- **loading:** Ruft `POST /initiate` auf
- **ready (nur Mobile):** "Wallet öffnen" Button → `window.location.href = walletUrl`
- **polling (Desktop):** Sofort nach `POST /initiate` – zeigt QR-Code + Spinner
- **polling (Mobile):** Nach Tap auf "Wallet öffnen" – zeigt Spinner
- **success:** Grünes Banner, `onPidReceived()` wird aufgerufen
- **error:** Rotes Banner mit Retry-Option

### Same-Device Rückkehr

Nach Wallet-Präsentation leitet die Wallet zur `redirect_uri` weiter – das ist `/done/:sessionId` auf dem Service (nicht mehr das Frontend). Die Seite zeigt eine statische Erfolgsmeldung. Das Frontend erkennt den Abschluss nur über Polling, nicht über URL-Parameter. (Der `wallet_session` URL-Parameter-Mechanismus ist im Code noch vorhanden als Fallback, wird im aktuellen Flow aber nicht genutzt.)

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

---

## Aktueller Stand (Februar 2026)

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

### ⏳ Noch ausstehend / nice-to-have
- [ ] **MdocSecurity18013 Workaround:** German Registrar CA auf Test-iPhone installieren (Einstellungen → Allgemein → Info → Zertifikatvertrauenseinstellungen → aktivieren). CA liegt unter `https://sandbox.eudi-wallet.org/api/ca`. Langfristig: SPRIND Wallet soll WRPAC Trust List nutzen.
- [ ] Same-Device Flow auf realem Gerät testen (braucht Frontend auf öffentlicher URL, z.B. Vercel)
- [ ] Adressfelder testen sobald PID mit Adressdaten verfügbar (SPRIND Demo-PID hat aktuell keine)
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

# Browser:
# http://localhost:3000/bewerbung
# → Schritt "Persönliche Angaben"
# → EUDIW Logo + Button "Mit EU Digital Identity Wallet ausfüllen" → QR-Code erscheint
# → Mit SPRIND EUDI Wallet App scannen → Daten freigeben → Formular wird befüllt
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
