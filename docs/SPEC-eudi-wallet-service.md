# EUDI Wallet Integration – Rebuild-Spezifikation

> **Stand:** 8. Mai 2026
> **Zweck:** Tech-stack-agnostische Spezifikation zum Nachbau des EUDI-Wallet-Service im Cookie-Cutter-Template.
> **Nicht enthalten:** Framework-spezifischer Code. Nur Verhalten, Schnittstellen und Protokoll-Details.
> **Migrations-Deltas:**
> - [`MIGRATION-DELTA-2026-04-28.md`](./MIGRATION-DELTA-2026-04-28.md) – Änderungen 16. April → 28. April
> - [`MIGRATION-DELTA-2026-05-04.md`](./MIGRATION-DELTA-2026-05-04.md) – Änderungen 28. April → 4. Mai
> **Verifikations-Test:** [`ERICA-TEST-2026-05-05.md`](./ERICA-TEST-2026-05-05.md) – Beweisführung dass unser Service HAIP-konform arbeitet (Adress-Bug definitiv wallet-seitig)

---

## Inhaltsverzeichnis

1. [Überblick & Architektur](#1-überblick--architektur)
2. [Environment-Variablen](#2-environment-variablen)
3. [POC 1 – PID-Verifikation (OpenID4VP)](#3-poc-1--pid-verifikation-openid4vp)
4. [POC 2 – Credential Issuance (OpenID4VCI)](#4-poc-2--credential-issuance-openid4vci)
5. [Kryptografie & Zertifikate](#5-kryptografie--zertifikate)
6. [Trust Lists](#6-trust-lists)
7. [SD-JWT-VC Credential Builder](#7-sd-jwt-vc-credential-builder)
8. [VP Token Validierung (7 Layer)](#8-vp-token-validierung-7-layer)
9. [PID Claims Extraktion](#9-pid-claims-extraktion)
10. [Session Management](#10-session-management)
11. [Frontend-Spezifikation](#11-frontend-spezifikation)
12. [Gotchas & Lessons Learned](#12-gotchas--lessons-learned)
13. [Aktueller Stand & Next Steps](#13-aktueller-stand--next-steps)
14. [Immomio GraphQL API Integration](#14-immomio-graphql-api-integration)
15. [File Upload Service](#15-file-upload-service)
16. [Adress-Autocomplete (Nominatim)](#16-adress-autocomplete-nominatim)
17. [WBS-System (Wohnberechtigungsschein)](#17-wbs-system-wohnberechtigungsschein)
18. [Exposé-Seite (Property-Daten)](#18-exposé-seite-property-daten)
19. [Key-Generierung & Sandbox-Onboarding](#19-key-generierung--sandbox-onboarding)

---

## 1. Überblick & Architektur

### Was das System tut

Der Service hat zwei Funktionen:

1. **POC 1 – PID-Verifikation:** Agiert als OpenID4VP Relying Party. Die EUDI Wallet präsentiert ihren PID (Personal Identification Data) per SD-JWT. Der Service validiert die Präsentation und extrahiert Personendaten (Name, Geburtsdatum, Adresse).

2. **POC 2 – Credential Issuance:** Agiert als OpenID4VCI Credential Issuer. Nach erfolgreicher PID-Verifikation (POC 1 als Unterschritt) wird ein neues Credential (z.B. Wohnungsgeberbestätigung) als SD-JWT-VC ausgestellt und in die Wallet übertragen.

### Kommunikationspartner

- **EUDI Wallet DE Sandbox** (Sprind GmbH, v0.2.0+, User-Agent: `IDGo/50` – Thales-Engine)
- **BMI Test Trust Lists** (PID-Provider- und Wallet-Provider-Zertifikats-Thumbprints)
- **Frontend** (Next.js Web-App, kommuniziert per REST mit dem Service)

### Architektur-Diagramm

```
┌─────────────┐     REST/JSON      ┌───────────────────┐    OpenID4VP/VCI    ┌─────────────┐
│   Frontend   │ ◄────────────────► │  EUDI Wallet      │ ◄────────────────►  │  EUDI Wallet │
│   (Next.js)  │                    │  Service (Backend) │                     │  DE Sandbox  │
└─────────────┘                    └───────────────────┘                     └─────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ BMI Trust     │
                                   │ Lists         │
                                   └──────────────┘
```

---

## 2. Environment-Variablen

| Variable | Required | Default | Beschreibung |
|---|---|---|---|
| `PORT` | Nein | `3001` | Server-Port |
| `SERVICE_URL` | Ja | `http://localhost:3001` | Öffentliche URL des Service (für Metadata, Callbacks) |
| `FRONTEND_URL` | Nein | `http://localhost:3000` | Frontend-URL (nur für Logging) |
| `ALLOWED_ORIGINS` | Nein | `http://localhost:3000` | CORS Origins, komma-separiert |
| `PRIVATE_KEY` | Ja | – | PKCS#8 PEM-String (ES256/P-256). `\n` Escape-Sequenzen werden ersetzt. |
| `CERT_CHAIN` | Ja | – | X.509 Zertifikatskette PEM (Leaf + Intermediate). `\n` Escape-Sequenzen werden ersetzt. |
| `TRUST_LIST_URL` | Nein | `https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists` | Basis-URL der Trust Lists |

---

## 3. POC 1 – PID-Verifikation (OpenID4VP)

### Gesamtablauf

```
Frontend                    Service                         Wallet App
   │                          │                                │
   │ POST /initiate           │                                │
   │ ────────────────────►    │                                │
   │ { sessionId, walletUrl } │                                │
   │ ◄────────────────────    │                                │
   │                          │                                │
   │  [QR-Code / Deep-Link]   │                                │
   │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ►  │
   │                          │                                │
   │                          │  GET /request/:sessionId       │
   │                          │ ◄──────────────────────────    │
   │                          │  [Signed JAR JWT]              │
   │                          │ ──────────────────────────►    │
   │                          │                                │
   │                          │  POST /callback/:sessionId     │
   │                          │ ◄──────────────────────────    │
   │                          │  { redirect_uri }              │
   │                          │ ──────────────────────────►    │
   │                          │                                │
   │  GET /result/:sessionId  │                                │
   │ ────────────────────►    │                                │
   │  { status, pidClaims }   │                                │
   │ ◄────────────────────    │                                │
```

### 3.1 POST /initiate

Erstellt eine VP-Session und gibt die Wallet-URL zurück.

**Request Body (optional JSON):**
```json
{ "returnUrl": "https://example.com" }
```
`returnUrl` wird nur bei Same-Device-Flow (Mobile) mitgesendet.

**Interne Schritte:**
1. `sessionId` = UUID v4
2. `nonce` = 32 Bytes random, base64url
3. Ephemeral ECDH-ES Key-Pair (P-256, extractable), Public Key als JWK mit `kid=UUID`, `use="enc"`, `alg="ECDH-ES"`
4. Session erstellen (TTL: 10 Minuten)
5. `clientId` = `x509_hash:<base64url(SHA-256(LeafCert DER))>` (siehe [Kryptografie](#5-kryptografie--zertifikate))
6. `requestUri` = `${SERVICE_URL}/request/${sessionId}`
7. `walletUrl` = `openid4vp://?client_id=${encode(clientId)}&request_uri=${encode(requestUri)}`

**Response:** `200`
```json
{
  "sessionId": "<uuid>",
  "walletUrl": "openid4vp://?client_id=x509_hash:...&request_uri=..."
}
```

### 3.2 GET /request/:sessionId

Wallet ruft diesen Endpoint ab, um den signierten JWT Authorization Request (JAR) zu erhalten.

**Response:** `200`
- `Content-Type: application/oauth-authz-req+jwt`
- `Cache-Control: no-store`
- Body: Compact JWT (SignJWT, ES256)

**JAR JWT Protected Header:**
```json
{
  "alg": "ES256",
  "typ": "oauth-authz-req+jwt",
  "x5c": ["<leaf-cert-base64>", "<intermediate-cert-base64>"]
}
```

**JAR JWT Payload:**
```json
{
  "aud": "https://self-issued.me/v2",
  "iat": <unix-seconds>,
  "client_id": "x509_hash:<thumbprint>",
  "response_type": "vp_token",
  "response_mode": "direct_post.jwt",
  "nonce": "<session-nonce>",
  "state": "<sessionId>",
  "response_uri": "<SERVICE_URL>/callback/<sessionId>",
  "dcql_query": { ... },
  "verifier_info": {
    "name": "Immomio",
    "logo_uri": "https://www.mieter.immomio.com/favicon.ico"
  },
  "client_metadata": {
    "jwks": { "keys": [<ephemeralPublicKeyJwk>] },
    "vp_formats_supported": {
      "dc+sd-jwt": {
        "sd-jwt_alg_values": ["ES256"],
        "kb-jwt_alg_values": ["ES256"]
      }
    },
    "encrypted_response_enc_values_supported": ["A128GCM", "A256GCM"]
  }
}
```

> **HINWEIS:** `verifier_info` ist per EUDI-ARF Section 3.2 für PID-Presentation empfohlen. Der Wallet-Consent-Screen kann damit "Immomio fragt Daten an" anzeigen statt nur Client-ID/Hash. Verifiziert durch ERICA am 5. Mai 2026 als einzige Verbesserungsempfehlung.

**DCQL Query (exakte Struktur):**
```json
{
  "credentials": [{
    "id": "pid-sd-jwt",
    "format": "dc+sd-jwt",
    "meta": { "vct_values": ["urn:eudi:pid:de:1"] },
    "claims": [
      { "id": "pid_given_name",          "path": ["given_name"] },
      { "id": "pid_family_name",         "path": ["family_name"] },
      { "id": "pid_birthdate",           "path": ["birthdate"] },
      { "id": "pid_address_street",      "path": ["address", "street_address"] },
      { "id": "pid_address_postal_code", "path": ["address", "postal_code"] },
      { "id": "pid_address_locality",    "path": ["address", "locality"] },
      { "id": "pid_address_country",     "path": ["address", "country"] }
    ]
  }],
  "credential_sets": [{
    "options": [["pid-sd-jwt"]],
    "required": true
  }]
}
```

> **GOTCHA:** Jeder Claim braucht ein `id`-Property. Ohne `id` ignoriert die SPRIND-Wallet die Claims stillschweigend.

> **GOTCHA:** Adress-Felder müssen als nested paths (`["address", "street_address"]`) angefragt werden, nicht als Top-Level `["address"]`. Die Wallet liefert die Felder nur einzeln.

> **GOTCHA:** Nur `dc+sd-jwt` anfordern, NICHT `mso_mdoc`. ISO 18013-5 Reader Auth erfordert die deutsche Registrar-Root-CA im iOS System Trust Store – die haben wir nicht.

**Error Responses:**
- `404`: Session nicht gefunden
- `410`: Session abgelaufen

### 3.3 POST /callback/:sessionId

Wallet sendet VP Token als verschlüsselten JWE (`direct_post.jwt`).

**Request:** `application/x-www-form-urlencoded`
- Feld `response`: JWE Compact Serialization (verschlüsselt mit dem ephemeral ECDH-ES Key)

**Verarbeitung:**
1. JWE entschlüsseln mit `session.ephemeralPrivateKey`
2. Entschlüsselter Inhalt wird in 4 Formaten versucht:
   - JARM JWT → decode → `vp_token` extrahieren
   - JSON mit `vp_token` als String
   - JSON mit `vp_token` als Object (DCQL-Format: `{ "pid-sd-jwt": ["eyJ..."] }`)
   - JSON Serialized JWS mit `payload` Feld
3. VP Token durch 7-Layer-Validierung (siehe [Kapitel 8](#8-vp-token-validierung-7-layer))
4. PID Claims extrahieren (siehe [Kapitel 9](#9-pid-claims-extraktion))
5. Session auf `complete` setzen, `pidClaims` speichern
6. Falls `session.issuanceSessionId` gesetzt → PID Claims automatisch in Issuance-Session übertragen

**Response (Erfolg):** `200`
```json
{ "redirect_uri": "<SERVICE_URL>/done/<sessionId>" }
```

**Error Responses:**
- `400`: Validierung fehlgeschlagen
- `404`: Session nicht gefunden
- `410`: Session abgelaufen

### 3.4 GET /result/:sessionId

Frontend pollt diesen Endpoint.

| Session Status | HTTP | Body | Nebeneffekt |
|---|---|---|---|
| Nicht gefunden | `404` | `{ error }` | – |
| Abgelaufen | `410` | `{ error }` | – |
| `pending` | `202` | `{ status: "pending" }` | – |
| `complete` | `200` | `{ status: "complete", pidClaims: {...} }` | Session löschen |
| `error` | `400` | `{ status: "error", errorMessage: "..." }` | Session löschen |

### 3.5 GET /done/:sessionId

Wallet leitet hierher nach erfolgreicher Präsentation.

- **Same-Device** (returnUrl vorhanden): HTML mit `<script>window.close()</script>`
- **Cross-Device** (kein returnUrl): Statische Erfolgsseite ("Daten erfolgreich übermittelt")

---

## 4. POC 2 – Credential Issuance (OpenID4VCI)

### Gesamtablauf

```
Frontend                     Service                        Wallet App
   │                           │                               │
   │ POST /issuer/initiate     │                               │
   │ ──────────────────────►   │                               │
   │ { sessionId,              │                               │
   │   vpSessionId, walletUrl }│                               │
   │ ◄──────────────────────   │                               │
   │                           │                               │
   │   [QR/Deep-Link für PID-Verifikation – identisch POC 1]  │
   │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►   │
   │                           │                               │
   │ GET /issuer/result/:id    │  (PID-Verifikation per VP)    │
   │ ──────────────────────►   │ ◄─────────────────────────►   │
   │ { status: "pid_verified", │                               │
   │   pidClaims }             │                               │
   │ ◄──────────────────────   │                               │
   │                           │                               │
   │ POST /issuer/create-offer │                               │
   │ ──────────────────────►   │                               │
   │ { walletUrl, txCode }     │                               │
   │ ◄──────────────────────   │                               │
   │                           │                               │
   │   [QR/Deep-Link für Credential Offer]                     │
   │   [Frontend zeigt PIN (txCode) an]                        │
   │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►   │
   │                           │                               │
   │                           │ GET /.well-known/openid-      │
   │                           │     credential-issuer         │
   │                           │ ◄─────────────────────────    │
   │                           │ GET /.well-known/oauth-       │
   │                           │     authorization-server      │
   │                           │ ◄─────────────────────────    │
   │                           │ GET /issuer/offer/:sessionId  │
   │                           │ ◄─────────────────────────    │
   │                           │ POST /issuer/token            │
   │                           │ ◄─────────────────────────    │
   │                           │ POST /issuer/credential       │
   │                           │ ◄─────────────────────────    │
   │                           │                               │
   │ GET /issuer/result/:id    │                               │
   │ ──────────────────────►   │                               │
   │ { status: "issued" }      │                               │
   │ ◄──────────────────────   │                               │
```

### 4.1 POST /issuer/initiate

Startet den kombinierten Issuance-Flow: erstellt Issuance-Session + verknüpfte VP-Session.

**Request Body (JSON):**
```json
{
  "credentialType": "wohnungsgeberbestaetigung",
  "returnUrl": "https://example.com"
}
```
- `credentialType`: `"wohnungsgeberbestaetigung"` | `"genossenschaft-mitglied"` (Default: `"wohnungsgeberbestaetigung"`)
- `returnUrl`: Optional, nur für Mobile Same-Device

**Interne Schritte:**
1. VP-Session erstellen (identisch zu POC 1, TTL: 10 Minuten)
2. VP-Session bekommt `issuanceSessionId`-Referenz
3. Issuance-Session erstellen:
   - `preAuthorizedCode` = 32 Bytes random, base64url
   - `txCode` = 4-stellige Zufallszahl (1000–9999) als String
   - Status: `pending_pid`
   - TTL: **15 Minuten**
4. Wallet-URL bauen (identisch zu POC 1, nutzt `vpSessionId`)

**Response:** `200`
```json
{
  "sessionId": "<issuanceSessionId>",
  "vpSessionId": "<vpSessionId>",
  "walletUrl": "openid4vp://?client_id=...&request_uri=..."
}
```

### 4.2 POST /issuer/link-pid

Fallback-Endpoint falls Auto-Link im Callback nicht greift.

**Request Body:**
```json
{
  "issuanceSessionId": "<uuid>",
  "vpSessionId": "<uuid>"
}
```

**Verarbeitung:**
1. Issuance-Session laden (muss Status `pending_pid` haben)
2. VP-Session laden (muss Status `complete` haben mit `pidClaims`)
3. PID Claims in Issuance-Session übertragen
4. Status auf `pid_verified` setzen
5. VP-Session löschen

**Response:** `200`
```json
{
  "status": "pid_verified",
  "pidClaims": { ... }
}
```

### 4.3 POST /issuer/create-offer/:sessionId

Frontend ruft dies nach PID-Verifikation auf.

**Voraussetzung:** Issuance-Session-Status muss `pid_verified` sein.

**Interne Schritte:**
1. Status auf `offer_created` setzen
2. `credentialOfferUri` = `${SERVICE_URL}/issuer/offer/${sessionId}`
3. `walletUrl` = `openid-credential-offer://?credential_offer_uri=${encode(credentialOfferUri)}`

**Response:** `200`
```json
{
  "sessionId": "<sessionId>",
  "credentialOfferUri": "<SERVICE_URL>/issuer/offer/<sessionId>",
  "walletUrl": "openid-credential-offer://?credential_offer_uri=...",
  "txCode": "4827"
}
```

> **WICHTIG:** `txCode` muss dem User im Frontend angezeigt werden. Die Wallet fragt den User nach diesem PIN.

### 4.4 GET /issuer/offer/:sessionId

Wallet holt das Credential Offer JSON.

**Zulässige Status:** `offer_created` oder `pid_verified`

**Response:** `200`
```json
{
  "credential_issuer": "<SERVICE_URL>",
  "credential_configuration_ids": ["wohnungsgeberbestaetigung"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "<base64url-32-bytes>",
      "tx_code": {
        "input_mode": "numeric",
        "length": 4,
        "description": "PIN aus der Immomio-App eingeben"
      }
    }
  }
}
```

> **GOTCHA:** Nur das `tx_code`-Objekt verwenden, NICHT auch `user_pin_required: true` (alter Draft). SPRIND-Wallet (Build 53+) interpretiert das `tx_code`-Objekt als "PIN-Eingabe nötig". Wenn beide gleichzeitig im Offer stehen, kommt's zu Konflikten und die Wallet zeigt einen weißen Screen.

### 4.5 Well-Known Metadata Endpoints

#### GET /.well-known/openid-credential-issuer

```json
{
  "credential_issuer": "<SERVICE_URL>",
  "credential_endpoint": "<SERVICE_URL>/issuer/credential",
  "token_endpoint": "<SERVICE_URL>/issuer/token",
  "nonce_endpoint": "<SERVICE_URL>/issuer/nonce",
  "credential_configurations_supported": {
    "wohnungsgeberbestaetigung": {
      "format": "dc+sd-jwt",
      "vct": "urn:credential:wohnungsgeberbestaetigung:1",
      "credential_signing_alg_values_supported": ["ES256"],
      "proof_types_supported": {
        "jwt": {
          "proof_signing_alg_values_supported": ["ES256"]
        }
      },
      "credential_metadata": {
        "display": [
          {
            "name": "Wohnungsgeberbestätigung",
            "locale": "de-DE",
            "description": "Bestätigung des Vermieters über den Einzug in eine Wohnung",
            "background_color": "#0066CC",
            "text_color": "#FFFFFF"
          },
          {
            "name": "Landlord Confirmation",
            "locale": "en-US",
            "description": "Landlord confirmation of move-in to a residence",
            "background_color": "#0066CC",
            "text_color": "#FFFFFF"
          }
        ]
      }
    },
    "genossenschaft-mitglied": {
      "format": "dc+sd-jwt",
      "vct": "urn:credential:genossenschaft-mitglied:1",
      "credential_signing_alg_values_supported": ["ES256"],
      "proof_types_supported": {
        "jwt": {
          "proof_signing_alg_values_supported": ["ES256"]
        }
      },
      "credential_metadata": {
        "display": [
          {
            "name": "Genossenschafts-Mitgliedsbescheinigung",
            "locale": "de-DE",
            "description": "Bescheinigung über die Mitgliedschaft in einer Wohnungsbaugenossenschaft",
            "background_color": "#1A7F5A",
            "text_color": "#FFFFFF"
          },
          {
            "name": "Cooperative Membership Certificate",
            "locale": "en-US",
            "description": "Certificate of membership in a housing cooperative",
            "background_color": "#1A7F5A",
            "text_color": "#FFFFFF"
          }
        ]
      }
    }
  },
  "grant_types_supported": [
    "urn:ietf:params:oauth:grant-type:pre-authorized_code"
  ],
  "display": [
    { "name": "Immomio", "locale": "de-DE" },
    { "name": "Immomio", "locale": "en-US" }
  ]
}
```

Header: `Cache-Control: no-store`

**Pflichtfelder im Detail (alle bestätigt nötig nach iterativem Debugging):**

| Feld | Warum nötig |
|---|---|
| `token_endpoint` (Top-Level) | BMI Developer Guide Template hat ihn dort, nicht nur in AS-Metadata |
| `nonce_endpoint` | HAIP-Pflicht: Wallet holt c_nonce für Proof-JWT bevor sie /token aufruft |
| `proof_types_supported.jwt.proof_signing_alg_values_supported` | Ohne das: `EudiWalletKit: No valid signing algorithms found in credential metadata: []` → User-facing Fehler "invalid transaction code" (irreführend!) |
| `credential_metadata.display` (verschachtelt) | SPRIND-Wallet erwartet `display` UNTER `credential_metadata`-Wrapper, nicht direkt unter Config (non-spec, aber so funktioniert's) |
| `display` (Issuer-Level) | Damit "Herausgeber: Immomio" im Consent-Screen angezeigt wird |

> **GOTCHA:** Format ist `dc+sd-jwt` (Digital Credentials), NICHT `vc+sd-jwt` (veraltet).

> **GOTCHA:** `display` MUSS unter `credential_metadata`-Wrapper für die SPRIND-Wallet, NICHT direkt auf der credential configuration. OpenID4VCI Spec sagt direkt – die Wallet macht's anders.

> **GOTCHA:** `credential_signing_alg_values_supported` (Issuer signiert Credential) ≠ `proof_signing_alg_values_supported` (Wallet signiert Proof-JWT). Beide getrennte Pflichtfelder.

#### GET /.well-known/oauth-authorization-server

```json
{
  "issuer": "<SERVICE_URL>",
  "authorization_endpoint": "<SERVICE_URL>/issuer/authorize",
  "token_endpoint": "<SERVICE_URL>/issuer/token",
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "urn:ietf:params:oauth:grant-type:pre-authorized_code"
  ],
  "pre_authorized_grant_anonymous_access_supported": true
}
```

Header: `Cache-Control: no-store`

> **GOTCHA:** `authorization_endpoint` MUSS gesetzt sein, auch bei Pre-Authorized Code Flow (wo er nie aufgerufen wird). Die SPRIND-Wallet validiert RFC 8414. Ohne diesen Eintrag: `ValidationError: Invalid authorization endpoint` nach Tap auf "Weiter zur Eingabe". Die URL muss nicht real existieren – Stub reicht.

> **GOTCHA:** `response_types_supported: ["code"]` wird ebenfalls per RFC 8414 erwartet, auch ohne Authorization-Code-Flow.

### 4.6 POST /issuer/token

Wallet tauscht Pre-Authorized Code + PIN gegen Access Token.

**Request:** `application/x-www-form-urlencoded` ODER `application/json`
```
grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=<code>
&tx_code=<4-digit-pin>
```

> **GOTCHA:** Sowohl `tx_code` (neuer Draft) als auch `user_pin` (alter Draft) als Parametername akzeptieren. Die SPRIND-Wallet kann beides senden.

**Validierung:**
1. `grant_type` muss exakt `urn:ietf:params:oauth:grant-type:pre-authorized_code` sein
2. `pre-authorized_code` muss vorhanden sein
3. Session per `preAuthorizedCode` finden
4. `tx_code` muss mit gespeichertem `session.txCode` übereinstimmen

**Response (Erfolg):** `200`
```json
{
  "access_token": "<32-byte-base64url>",
  "token_type": "Bearer",
  "expires_in": 600,
  "c_nonce": "<16-byte-base64url>",
  "c_nonce_expires_in": 300
}
```

**Error Responses:**
- `400` `{ error: "unsupported_grant_type" }`
- `400` `{ error: "invalid_request", error_description: "Missing pre-authorized_code" }`
- `400` `{ error: "invalid_grant", error_description: "Invalid pre-authorized code" }`
- `400` `{ error: "invalid_grant", error_description: "Invalid tx_code" }`

### 4.7 POST /issuer/credential

Wallet sendet Proof-of-Possession und erhält das SD-JWT-VC Credential.

**Request:**
- `Authorization: Bearer <access_token>`
- Body (JSON):
```json
{
  "format": "dc+sd-jwt",
  "proof": {
    "proof_type": "jwt",
    "jwt": "<compact-jwt>"
  }
}
```

**Proof JWT Validierung:**
1. Header `jwk` enthält Holder Public Key → extrahieren
2. Verifizieren mit `typ: "openid4vci-proof+jwt"`, Algorithmus aus Header (`alg`, Default ES256)
3. `nonce` im Payload muss mit `session.cNonce` übereinstimmen (im POC: Warnung bei Mismatch, kein Abbruch)

**Response (Erfolg):** `200`
```json
{
  "credential": "<sd-jwt-vc-compact-string>",
  "format": "dc+sd-jwt",
  "c_nonce": "<new-16-byte-base64url>",
  "c_nonce_expires_in": 300
}
```

**Error Responses:**
- `401` `{ error: "invalid_token" }` – fehlender/ungültiger Bearer Token
- `400` `{ error: "invalid_request", error_description: "PID not verified" }`
- `500` `{ error: "server_error", error_description: "Credential creation failed" }`

### 4.8 POST /issuer/nonce

Liefert einen frischen `c_nonce` für Proof-of-Possession JWTs.

**Response:** `200`
```json
{
  "c_nonce": "<16-byte-base64url>",
  "c_nonce_expires_in": 300
}
```

### 4.9 GET /issuer/result/:sessionId

Frontend pollt diesen Endpoint für den Issuance-Flow-Status.

| Status | HTTP | Body | Nebeneffekt |
|---|---|---|---|
| Nicht gefunden | `404` | `{ error }` | – |
| Abgelaufen | `410` | `{ error }` | Session löschen |
| `pending_pid` | `202` | `{ status: "pending_pid" }` | – |
| `offer_created` | `202` | `{ status: "offer_created" }` | – |
| `pid_verified` | `200` | `{ status: "pid_verified", pidClaims: {...} }` | – |
| `issued` | `200` | `{ status: "issued" }` | Session löschen |
| `error` | `400` | `{ status: "error", errorMessage: "..." }` | Session löschen |

---

## 5. Kryptografie & Zertifikate

### Schlüsselmaterial

| Zweck | Algorithmus | Quelle |
|---|---|---|
| JAR-Signatur | ES256 (ECDSA P-256 SHA-256) | `PRIVATE_KEY` env (PKCS#8 PEM) |
| Zertifikatskette | X.509 (Leaf + Intermediate) | `CERT_CHAIN` env (PEM) |
| VP Response Verschlüsselung | ECDH-ES (P-256) | Ephemeral Key per Session |
| Credential-Signatur | ES256 (ECDSA P-256 SHA-256) | Gleicher `PRIVATE_KEY` |

### client_id Berechnung (x509_hash)

```
1. CERT_CHAIN PEM einlesen, \n Escapes ersetzen
2. Regex: /-----BEGIN CERTIFICATE-----\r?\n([\s\S]+?)\r?\n-----END CERTIFICATE-----/g
3. Erstes Zertifikat (Leaf) nehmen, Base64-Body extrahieren (Newlines entfernen)
4. Base64 → Binary (DER-Bytes)
5. SHA-256 Hash der DER-Bytes
6. Hash als base64url kodieren
7. Ergebnis: "x509_hash:<base64url_hash>"
```

### PEM-Parsing

`\n` Escape-Sequenzen in Env-Variablen werden als `string.replace(/\\n/g, '\n')` ersetzt (für Railway/Docker Deployment).

---

## 6. Trust Lists

### Quelle

- `${TRUST_LIST_URL}/pid-provider.jwt` – PID-Provider Zertifikate
- `${TRUST_LIST_URL}/wallet-provider.jwt` – Wallet-Provider Zertifikate

Beide werden parallel beim Startup geladen. Bei Fehler: leerer Cache (kein Crash).

### Cache

- TTL: 24 Stunden
- Wird beim Startup geladen
- Automatisch erneuert wenn TTL abgelaufen

### Parsing (Dual-Format)

**Neues Format (ETSI TS 119 602 LoTE, seit März 2026):**
```
JWT Payload → LoTE.TrustedEntitiesList[]
  → .TrustedEntityServices[]
    → .ServiceInformation.ServiceDigitalIdentity.X509Certificates[]
      → .val (base64-kodierte DER-Zertifikate)
```
Für jeden `val`: SHA-256 des DER-Binärwerts berechnen → base64url = Thumbprint

**Legacy-Format (Fallback):**
```
JWT Payload → entries[] ODER keys[]
  → ['x5t#S256'] (direkte SHA-256 Thumbprints)
```

> **GOTCHA:** Das Format hat sich im März 2026 geändert. Der Parser muss beide Formate unterstützen.

---

## 7. SD-JWT-VC Credential Builder

### Abhängigkeiten

- `@sd-jwt/core` (v0.14+) für SD-JWT Erstellung
- `jose` (v6+) für JWT-Operationen

### Signer

ECDSA P-256 SHA-256 via WebCrypto (`crypto.subtle.sign`). Output: base64url-kodierte Signatur.

### Hasher

SHA-256 via Node `crypto.createHash`. Output: `Uint8Array`.

### Salt Generator

`randomBytes(16).toString('base64url')`

### JWT Header (beide Credential-Typen)

```json
{
  "typ": "dc+sd-jwt",
  "x5c": ["<leaf-cert-base64>", "<intermediate-cert-base64>"]
}
```

### Wohnungsgeberbestätigung

**VCT:** `urn:credential:wohnungsgeberbestaetigung:1`

**Payload:**
```json
{
  "vct": "urn:credential:wohnungsgeberbestaetigung:1",
  "iss": "<SERVICE_URL>",
  "iat": <unix-seconds>,
  "exp": <iat + 365 Tage>,
  "cnf": { "jwk": <holder-public-key> },
  "given_name": "<aus PID>",
  "family_name": "<aus PID>",
  "birthdate": "<aus PID>",
  "street_address": "Musterstraße 42",
  "postal_code": "10115",
  "locality": "Berlin",
  "move_in_date": "2026-04-01",
  "landlord_name": "Immobilien GmbH"
}
```

**Selektiv offengelegte Felder (_sd):** `given_name`, `family_name`, `birthdate`, `street_address`, `postal_code`, `locality`, `move_in_date`, `landlord_name`

> **Hinweis:** `street_address`, `postal_code`, `locality`, `move_in_date`, `landlord_name` sind derzeit Mock-Daten. In der Produktion kommen diese aus dem Fachsystem.

### Genossenschafts-Mitgliedsbescheinigung

**VCT:** `urn:credential:genossenschaft-mitglied:1`

**Payload:**
```json
{
  "vct": "urn:credential:genossenschaft-mitglied:1",
  "iss": "<SERVICE_URL>",
  "iat": <unix-seconds>,
  "exp": <iat + 365 Tage>,
  "cnf": { "jwk": <holder-public-key> },
  "given_name": "<aus PID>",
  "family_name": "<aus PID>",
  "birthdate": "<aus PID>",
  "cooperative_name": "Berliner Wohnungsbaugenossenschaft eG",
  "membership_number": "BWG-2026-04217",
  "member_since": "2026-03-15"
}
```

**Selektiv offengelegte Felder (_sd):** `given_name`, `family_name`, `birthdate`, `cooperative_name`, `membership_number`, `member_since`

### cnf (Confirmation) Feld

Nur gesetzt wenn `holderPublicKeyJwk` vorhanden ist (aus dem Proof JWT im Credential-Request).

---

## 8. VP Token Validierung (7 Layer)

Alle Layer laufen sequentiell, fail-fast. Ein Fehler in Layer N stoppt die Verarbeitung.

### Layer 1 – Struktur & Transport

- JWE-Size-Check: max 2.000.000 Bytes
- JWE entschlüsseln mit Session ephemeral Key
- 4 Response-Formate erkennen:
  1. JARM JWT (entschlüsselter Inhalt ist ein Compact JWT)
  2. JSON mit `vp_token` als String
  3. JSON mit `vp_token` als DCQL-Objekt (`{ "pid-sd-jwt": ["eyJ...~...~kbjwt"] }`)
  4. JSON Serialized JWS (Feld `payload`, base64url-dekodieren)
- Unverschlüsselter Fallback: `vp_token` als String, max 1.000.000 Bytes

### Layer 2 – Session Binding

- `payload.nonce` muss mit `session.nonce` übereinstimmen (Replay-Schutz)
- `payload.aud` muss `clientId` oder `SERVICE_URL` sein
- `payload.iat` darf max 60 Sekunden in der Zukunft liegen (Clock-Skew-Toleranz)
- `payload.exp` darf nicht abgelaufen sein

### Layer 3 – Credential Assurance

- Issuer JWT (erster Teil des SD-JWT) dekodieren
- `payload.exp` prüfen (Credential-Ablauf)
- Trust List Check: Wenn Trust List leer → Warnung, kein Fehler (Sandbox-Modus)
- Wenn `header.x5c` vorhanden → Chain-Validierung loggen (Sandbox: immer OK)

### Layer 4 – Holder Binding (KB-JWT)

- Letzter nicht-leerer Teil des SD-JWT = Key Binding JWT
- `header.typ` muss `"kb+jwt"` sein
- `payload.nonce` muss mit Session-Nonce übereinstimmen

### Layer 5 – Wallet Integrity

- Sucht `wallet_attestation` oder `wal` im Payload
- Wenn fehlend: Warnung (Sandbox-Modus, kein Fehler)

### Layer 6 – Selective Disclosure

- SD-JWT auf `~` splitten, leere Strings filtern
- Mindestens 2 Teile (Issuer JWT + mindestens 1 Disclosure)
- Disclosures = `parts[1..n-1]` (zwischen Issuer JWT und KB-JWT)

### Layer 7 – Business Rules

- `given_name` nicht leer
- `family_name` nicht leer
- `birthdate` nicht leer
- `birthdate` muss Format `YYYY-MM-DD` haben (Regex: `/^\d{4}-\d{2}-\d{2}$/`)

---

## 9. PID Claims Extraktion

### SD-JWT Disclosure Dekodierung

1. SD-JWT auf `~` splitten
2. `parts[0]` = Issuer JWT → dekodieren (ohne Signaturprüfung)
3. `parts[1..n-1]` = Disclosures (letzter Teil = KB-JWT, ignorieren)
4. Jede Disclosure: Base64url dekodieren → JSON-Array
   - 3 Elemente: `[salt, claimName, claimValue]` → Named Claim
   - 2 Elemente: `[null, '', value]` → Array Item (ignorieren für PID)
5. Disclosed Claims überschreiben Issuer JWT Claims

### Adress-Felder Resolution

Adresse kann als verschachteltes Objekt oder als Top-Level Claims ankommen:

```
1. Prüfe claims.address als Objekt → extrahiere street_address, postal_code, locality, country
2. Fallback: Prüfe Top-Level claims.street_address, claims.postal_code, etc.
```

### PidClaims Interface

```typescript
{
  given_name: string       // Pflicht (Fallback: '')
  family_name: string      // Pflicht (Fallback: '')
  birthdate: string        // Pflicht (Fallback: '')
  street_address?: string  // Optional
  postal_code?: string     // Optional
  locality?: string        // Optional
  country?: string         // Optional
}
```

---

## 10. Session Management

### VP Sessions (In-Memory)

| Parameter | Wert |
|---|---|
| TTL | 10 Minuten |
| Cleanup-Intervall | 5 Minuten |
| Lookup | Per `sessionId` (Map) |

**Felder:** `nonce`, `ephemeralPrivateKey`, `ephemeralPublicKeyJwk`, `createdAt`, `expiresAt`, `status` (`pending`/`complete`/`error`), `pidClaims?`, `errorMessage?`, `issuanceSessionId?`

### Issuance Sessions (In-Memory)

| Parameter | Wert |
|---|---|
| TTL | 15 Minuten |
| Cleanup-Intervall | 5 Minuten |
| Lookup | Per `sessionId` (Map), per `preAuthorizedCode` (Linear Scan), per `accessToken` (Linear Scan) |

**Felder:** `credentialType`, `preAuthorizedCode`, `txCode`, `accessToken?`, `cNonce?`, `cNonceExpiresAt?`, `pidClaims?`, `holderPublicKeyJwk?`, `createdAt`, `expiresAt`, `status` (`pending_pid`/`pid_verified`/`offer_created`/`issued`/`error`), `errorMessage?`

### Return URLs (Separate Map)

- Gespeichert separat von Sessions (damit `/done/` nach Session-Löschung noch funktioniert)
- TTL: 15 Minuten (per `setTimeout`)

---

## 11. Frontend-Spezifikation

### Routen

| Route | Zweck |
|---|---|
| `/` | Redirect → `/expose` |
| `/expose` | Wohnungsanzeige (Exposé) |
| `/bewerbung` | 5-Step Bewerbungsformular mit PID-Verifikation (POC 1) |
| `/bewerbung/erfolg` | Bewerbung erfolgreich |
| `/ausstellen` | Credential-Typ-Auswahl (POC 2) |
| `/ausstellen/[type]` | 3-Step Issuance-Flow |

### Wallet-Komponenten – Gemeinsame Patterns

Alle drei Wallet-Komponenten teilen diese Logik:

| Parameter | Wert |
|---|---|
| Poll-Intervall | 2.000 ms |
| Poll-Timeout | 180.000 ms (3 Minuten) |
| Timeout-Meldung | "Zeitüberschreitung – bitte erneut versuchen." |
| Mobile-Erkennung | UA Regex: `/Android\|webOS\|iPhone\|iPad\|iPod\|BlackBerry\|IEMobile\|Opera Mini/i` |

**Mobile:** Deep-Link (`window.location.href = walletUrl`), Polling läuft weiter
**Desktop:** QR-Code (200×200px), Polling läuft parallel

**`?wallet_session=` Parameter:** Bei Same-Device-Redirect prüft `EudiWalletButton` beim Mount ob ein `wallet_session` Query-Parameter in der URL steht und startet dann automatisch das Polling.

### Komponente 1: EudiWalletButton (POC 1 – Bewerbung)

- API: `POST /initiate` → `GET /result/:sessionId`
- Erfolg bei: `status === "complete"` + `pidClaims` vorhanden
- Callback: `onPidReceived(claims)` → befüllt Formularfelder

**Wallet-verifizierte Felder → Formular-Mapping:**

| PID Claim | Formularfeld | Step |
|---|---|---|
| `given_name` | `firstname` | 2 (PersonalInfo) |
| `family_name` | `lastname` | 2 (PersonalInfo) |
| `birthdate` | `dateOfBirth` | 4 (Household) |
| `street_address` | `street` | 3 (ContactInfo) |
| `postal_code` | `zipCode` | 3 (ContactInfo) |
| `locality` | `city` | 3 (ContactInfo) |

Verifizierte Felder zeigen ein grünes "Aus Wallet" Badge.

### Komponente 2: PidVerificationStep (POC 2 – Ausstellen, Schritt 1)

- API: `POST /issuer/initiate` → `GET /issuer/result/:sessionId`
- Erfolg bei: `status === "pid_verified"` + `pidClaims` vorhanden
- Callback: `onPidVerified(claims, issuanceSessionId)`

### Komponente 3: IssuanceWalletButton (POC 2 – Ausstellen, Schritt 3)

- API: `POST /issuer/create-offer/:sessionId` → `GET /issuer/result/:sessionId`
- Zwischenstatus `creating`: Spinner während Offer erstellt wird
- **PIN-Anzeige:** `txCode` aus der Create-Offer-Response wird groß (monospace, 3xl) angezeigt
- Erfolg bei: `status === "issued"`
- Callback: `onIssued()`

### Bewerbungs-Flow (POC 1 Integration)

5-Step-Formular mit LocalStorage-Persistenz (`immomio_application_form_${propertyId}`):

1. **Email:** Validierung per GraphQL (`checkGuestApplication`), Token erhalten
2. **Persönliche Daten:** Name, WBS-Daten + `EudiWalletButton`
3. **Kontaktdaten:** Adresse (mit Nominatim Autocomplete), Telefon, Portraitfoto
4. **Haushalt:** Geburtsdatum, Beruf, Einkommen, Haushaltsgröße
5. **Dokumente:** Einkommensnachweis, SCHUFA, Sonstiges → Submit per GraphQL (`applyAsGuest`)

### Ausstellungs-Flow (POC 2)

3-Step-Flow:

1. **Identität:** `PidVerificationStep` → PID aus Wallet verifizieren
2. **Vorschau:** `CredentialPreview` zeigt PID-Daten (grün, "PID") + Mock-Daten (grau, "Mock") → Button "Weiter zur Ausstellung"
3. **Ausstellen:** `IssuanceWalletButton` → QR/Deep-Link + PIN → Credential in Wallet

### Frontend Environment-Variablen

| Variable | Default | Beschreibung |
|---|---|---|
| `NEXT_PUBLIC_EUDI_SERVICE_URL` | `http://localhost:3001` | Backend-URL |
| `NEXT_PUBLIC_PROPERTY_ID` | `6850da6f-a361-40ec-bea2-3cbf2f8fe8b3` | Standard Property-ID |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | – | Immomio GraphQL API |
| `NEXT_PUBLIC_FILE_UPLOAD_ENDPOINT` | – | File Upload Service |
| `NEXT_PUBLIC_FILE_UPLOAD_TOKEN` | – | Upload Auth Token |

---

## 12. Gotchas & Lessons Learned

### POC 1 – PID-Verifikation (OpenID4VP)

1. **Format ist `dc+sd-jwt`, nicht `vc+sd-jwt`.** Das alte Format wird von der SPRIND-Wallet nicht akzeptiert.

2. **DCQL Claims brauchen ein `id`-Property.** Ohne `id` ignoriert die Wallet die Claims.

3. **Adress-Claims als nested paths anfordern** (`["address", "street_address"]`), nicht als `["address"]` Top-Level. Die Wallet liefert nur die einzelnen Felder. **Achtung:** Aktuell besteht ein Wallet-Bug, durch den nested address-Disclosures NICHT gesendet werden, obwohl die Wallet die Daten hat. Reported an SPRIND.

4. **Nur `dc+sd-jwt` anfordern, kein `mso_mdoc`.** ISO 18013-5 Reader Auth braucht die deutsche Registrar-Root-CA im iOS System Trust Store.

5. **`credential_sets` mit `required: true` in der DCQL Query** ist nötig, damit die Wallet den Consent-Screen zeigt.

6. **VP Response kommt in 4 möglichen Formaten** (JARM JWT, JSON+vp_token String, JSON+vp_token DCQL-Objekt, JSON Serialized JWS). Alle müssen unterstützt werden.

7. **Wallet User-Agent ist `IDGo/53`** (Thales-Engine, Build je nach Version), nicht der App-Name. Nicht davon verwirren lassen.

### POC 2 – Issuance Metadata (alle 5 sind ZWINGEND erforderlich)

8. **`token_endpoint` MUSS auf Top-Level der Issuer-Metadata** stehen, nicht nur in der `oauth-authorization-server`-Metadata. BMI Developer Guide Template macht's so.

9. **`nonce_endpoint` MUSS in der Issuer-Metadata advertised werden** (HAIP-Pflicht). Die Wallet ruft diesen Endpoint VOR dem Token-Endpoint auf, um einen frischen `c_nonce` für den Proof-JWT zu holen.

10. **`authorization_endpoint` MUSS in der AS-Metadata stehen,** auch bei Pre-Authorized Code Flow. SPRIND-Wallet validiert RFC 8414. Stub-URL reicht (wird nie aufgerufen). Sonst: `ValidationError: Invalid authorization endpoint`.

11. **`response_types_supported: ["code"]`** wird ebenfalls per RFC 8414 erwartet, auch wenn Auth-Code-Flow nicht genutzt wird.

12. **`proof_types_supported.jwt.proof_signing_alg_values_supported` MUSS in der credential configuration** sein. Ohne dieses Feld bricht die Wallet INTERN ab nach PIN-Eingabe und zeigt User-facing den irreführenden Fehler "invalid transaction code". Echter Fehler im Wallet-Log: `EudiWalletKit: No valid signing algorithms found in credential metadata: []`.

13. **`display` MUSS unter `credential_metadata`-Wrapper** in der Credential-Config stehen, NICHT direkt unter der Config. Spec sagt direkt – die SPRIND-Wallet macht's anders. Ohne richtige Position: weißer Screen statt Consent.

### POC 2 – Issuance Offer

14. **Nur `tx_code`-Objekt im Offer verwenden** (neuer OID4VCI Draft), NICHT zusätzlich `user_pin_required: true` (alter Draft). Beides gleichzeitig führt zu Wallet-Konflikt → weißer Screen. SPRIND-Wallet (Build 53+) interpretiert das `tx_code`-Objekt korrekt.

15. **Token Endpoint: Sowohl `tx_code` als auch `user_pin` als Parameternamen akzeptieren** (welchen die Wallet sendet hängt von ihrer Draft-Version ab).

16. **Token Endpoint: Sowohl `application/x-www-form-urlencoded` als auch `application/json`** als Content-Type akzeptieren.

### POC 2 – Sandbox-Trust-Mythos

17. **In der SPRIND Sandbox sind KEINE Rulebook/Trust-List-Registrierungen nötig.** Was lange wie ein Trust-Infrastructure-Problem aussah (Wallet bricht nach 1 Sekunde ab), waren in Wirklichkeit fehlende Metadata-Felder (siehe 8–13). Bestätigt durch SPRIND.

### Trust Lists

18. **Trust List Format hat sich im März 2026 geändert** (von direkten `x5t#S256` Thumbprints zu ETSI TS 119 602 LoTE mit verschachtelten Zertifikaten). Parser muss beide Formate können.

### Kryptografie

19. **PEM `\n` Escapes:** In Railway/Docker werden `\n` in Env-Variablen als Literal-String gespeichert. Vor dem Parsen `replace(/\\n/g, '\n')` anwenden.

20. **Ephemeral Key muss `extractable: true` sein,** sonst kann der Public Key nicht als JWK exportiert werden.

### Bekannte Wallet-Bugs (gemeldet, nicht fix-bar bei uns)

21. **Adress-Disclosures bei OpenID4VP werden nicht gesendet** obwohl in der gespeicherten PID vorhanden. Wallet-UI zeigt "Stadt des Wohnsitzes" mit Wert = Label (UI-Glitch). Backend bekommt nur given_name, family_name, birthdate. **Definitiv wallet-seitig:** ERICA-Reference-Implementation sendet bei identischer DCQL-Anfrage alle Adressfelder korrekt. Siehe [ERICA-TEST-2026-05-05.md](./ERICA-TEST-2026-05-05.md). Stand 8. Mai 2026: trotz mehrerer Wallet-Updates (IDGo/53 → IDGo/55) weiterhin reproduzierbar.

22. **Wallet zeigt "invalid transaction code"** als User-Facing-Fehler bei diversen Ursachen (fehlende `proof_types_supported`, falsche tx_code-Format, etc.). Der echte Fehler steht nur im Wallet-Log.

23. **Post-Issuance "Schluckauf":** Sporadisch nach erfolgreicher Issuance navigiert die Wallet in einen weiteren ungewollten Flow. Beobachtet:
    - Wallet startet automatisch eine PID-Verifikation gegen unsere alte Session (404 weil bereits gelöscht)
    - Wallet zeigt den Issuance-Consent + PIN-Eingabe nochmal an (gecachter Offer), schlägt beim Re-Validate fehl

    **Wichtig:** Das eigentliche Issuance ist erfolgreich. Das Credential ist in der Wallet gespeichert. Es ist nur der Folgefehler der irritiert. Nicht-deterministisch – tritt nicht bei jeder Issuance auf.

24. **MDVM-Attestation-Failure** (`IOS_ATTESTATION_FAILURE` bei `POST /v1/mdvm/ios/renewal`) nach SPRIND-Backend-Updates. Wallet bleibt bei der PIN-Eingabe für PID-Verifikation hängen, weil Apple DeviceCheck Assertion vom SPRIND-Backend abgelehnt wird. **Workaround:** PID in der Wallet löschen und neu ausstellen – das triggert eine MDVM-Neuregistrierung und der State ist wieder konsistent. Wiederkehrender Bug nach Backend-Deployments – am 4. Mai (Service-Version `d51a62a`) und 8. Mai (Service-Version `709f33f`) beobachtet.

### Behobene Wallet-Bugs (mit IDGo/55 nicht mehr reproduzierbar)

25. **Erster Scan zeigt weißen Screen** (war Race Condition beim ersten Aufruf nach Anzeige). Mit Wallet-Version IDGo/55 nicht mehr reproduzierbar.

26. **BDR PID-Issuer "tokenURL is empty"** nach Registration-Cert-Format-Änderung. Mit aktueller Wallet-Version + frischer Demo-PID-Ausstellung behoben.

### Demo-Vorbereitung: Pre-Show-Checkliste

Wegen der wiederkehrenden SPRIND-Backend-Regressions (insb. Bug 24) sollte vor jeder Live-Demo (Wohnzukunftstag etc.) folgende Checkliste durchlaufen werden:

1. **Min. 30 Min vor der Demo:** Kompletten Flow einmal durchspielen (PID-Verifikation + Credential-Issuance)
2. **Falls MDVM-Attestation-Fehler auftritt:** PID in Wallet löschen + neu ausstellen (5 Min)
3. **Backup-Plan:** zweites Handy mit frisch eingerichteter Wallet als Reserve
4. **HAIP-Konformität bestätigen:** ERICA lokal starten + curl-Test gegen unseren Service (siehe [ERICA-TEST-2026-05-05.md](./ERICA-TEST-2026-05-05.md))

---

## 13. Aktueller Stand & Next Steps

### Was funktioniert (Stand 8. Mai 2026)

| Feature | Status |
|---|---|
| POC 1: PID-Verifikation (OpenID4VP) | ✅ Funktioniert vollständig |
| PID Claims Extraktion (7-Layer-Validierung) | ✅ Funktioniert vollständig |
| Bewerbungs-Flow mit Wallet-Daten | ✅ Funktioniert vollständig |
| Trust List Laden + Parsing (Dual-Format) | ✅ Funktioniert vollständig |
| **POC 2: Credential Issuance End-to-End** | ✅ **Funktioniert vollständig** |
| POC 2: Wohnungsgeberbestätigung in Wallet | ✅ Bestätigt mit IDGo/55 |
| POC 2: Genossenschafts-Mitgliedsbescheinigung in Wallet | ✅ Bestätigt mit IDGo/55 |
| **HAIP-Konformität verifiziert** | ✅ **Mit ERICA bestätigt am 5. Mai 2026** (98% Profile-aligned, Response Compliance 100%) |

### Bekannte Probleme (Wallet-Bugs, an SPRIND gemeldet)

| Feature | Problem | Severity | Erste Sichtung | Letzte Bestätigung |
|---|---|---|---|---|
| POC 1: Adress-Disclosures | Wallet sendet keine `address`-Disclosures, obwohl PID die Daten enthält. **Verifiziert wallet-seitig**: ERICA-Reference-Wallet sendet alle Adressfelder korrekt bei identischer DCQL-Anfrage (siehe [ERICA-TEST-2026-05-05.md](./ERICA-TEST-2026-05-05.md)). | 🟡 Mittel | März 2026 | 5. Mai 2026 |
| POC 2: Post-Issuance "Schluckauf" | Nach erfolgreicher Issuance navigiert die Wallet sporadisch in einen weiteren ungewollten Flow (PID-Presentation oder Issuance-Wiederholung) und zeigt einen Fehler. Der eigentliche Issuance ist trotzdem erfolgreich – Credential ist gespeichert. | 🟡 Mittel (kosmetisch) | 4. Mai 2026 | 4. Mai 2026 |
| POC 1: MDVM-Attestation-Recurrence | `IOS_ATTESTATION_FAILURE` blockiert PIN-Eingabe sporadisch nach SPRIND-Backend-Updates. **Workaround:** PID in der Wallet löschen und neu ausstellen → MDVM-State wird neu registriert. | 🔴 Hoch (blockiert POC 1) | 4. Mai 2026 | 8. Mai 2026 |
| POC 2: Wallet-Display | Credential-Karte zeigt nur background_color, name erst nach Tap auf Info-Button | 🟢 Niedrig | 28. April 2026 | 4. Mai 2026 |

### Behobene Wallet-Probleme

| Problem | Status |
|---|---|
| White Screen beim ersten Credential-Offer-Scan | ✅ Mit Wallet-Version IDGo/55 nicht mehr reproduzierbar |
| BDR PID-Issuer "tokenURL is empty" Fehler | ✅ Mit aktueller Wallet-Version + Demo-PID-Neuausstellung behoben |

### Wie das Issuance-Problem gelöst wurde

Lange angenommen war eine fehlende Trust-Infrastruktur (Rulebook, LoTE-Eintrag). **SPRIND hat bestätigt:** in der Sandbox sind keine Rulebook-/Registration-Requirements nötig. Das Problem waren ausschließlich fehlende Metadata-Felder.

Notwendige Fixes (siehe Abschnitt 12, Punkte 8–13):
1. `token_endpoint` auf Top-Level der Issuer-Metadata
2. `nonce_endpoint` advertised
3. `authorization_endpoint` in AS-Metadata (Stub reicht, RFC 8414 Pflicht)
4. `response_types_supported: ["code"]` in AS-Metadata
5. `proof_types_supported.jwt.proof_signing_alg_values_supported` in Credential-Config
6. `display` unter `credential_metadata`-Wrapper
7. `tx_code`-Objekt im Offer (ohne `user_pin_required`)
8. Beide Credential-Konfigurationen (`wohnungsgeberbestaetigung` UND `genossenschaft-mitglied`) in `credential_configurations_supported` deklariert

### Next Steps

1. **POC 1: Wallet-Bug Adress-Disclosures** – auf SPRIND-Fix warten, in Zwischenzeit Adresse manuell vom User erfragen
2. **Credential-Daten aus Fachsystem** – aktuell sind `street_address`, `move_in_date`, `landlord_name`, `cooperative_name`, `membership_number` etc. Mock-Werte in `credential-builder.ts`. Ans Immomio-Backend anbinden
3. **Wohnzukunftstag (Ende Juni 2026)** – Demo-fähig vorbereiten, gemeinsames Plenum mit GDW und SPRIND geplant. Im Demo-Skript einplanen: "Falls nach erfolgreicher Ausstellung ein zusätzlicher Screen erscheint, einfach mit X schließen – das Credential ist bereits gespeichert."
4. **Cookie-Cutter-Migration** – Service in immomio-Standard-Tech-Stack neu bauen (siehe `MIGRATION-DELTA-2026-04-28.md` und `MIGRATION-DELTA-2026-05-04.md`)

### Offene Fragen

- POC 1: Wann wird der Wallet-Bug für nested Adress-Disclosures behoben?
- POC 2: Wann wird der Wallet-Bug für den weißen Screen beim ersten Scan behoben?
- Wallet-Display: Kann man die Card-Anzeige (Name auf der Karte) per Metadata steuern oder ist das ein Wallet-Limit?

---

## Anhang A: Vollständige Endpoint-Tabelle

| Method | Path | Zweck |
|---|---|---|
| `GET` | `/health` | Health Check → `{ status: "ok", timestamp }` |
| `POST` | `/initiate` | VP-Session erstellen |
| `GET` | `/request/:sessionId` | JAR an Wallet liefern |
| `POST` | `/callback/:sessionId` | VP Token von Wallet empfangen |
| `GET` | `/result/:sessionId` | VP-Ergebnis pollen |
| `GET` | `/done/:sessionId` | Wallet-Redirect Landingpage |
| `GET` | `/.well-known/openid-credential-issuer` | Issuer Metadata |
| `GET` | `/.well-known/oauth-authorization-server` | OAuth AS Metadata |
| `POST` | `/issuer/initiate` | Issuance-Flow starten |
| `POST` | `/issuer/link-pid` | PID Claims manuell verknüpfen |
| `POST` | `/issuer/create-offer/:sessionId` | Credential Offer erstellen |
| `GET` | `/issuer/offer/:sessionId` | Credential Offer JSON |
| `POST` | `/issuer/token` | Token Exchange |
| `POST` | `/issuer/credential` | Credential ausstellen |
| `POST` | `/issuer/nonce` | Frischer c_nonce |
| `GET` | `/issuer/result/:sessionId` | Issuance-Status pollen |

## Anhang B: CORS-Konfiguration

- Origins: `ALLOWED_ORIGINS` (komma-separiert)
- Methoden: `GET, POST, OPTIONS`
- Header: `Content-Type, Authorization`

## 14. Immomio GraphQL API Integration

Das Frontend kommuniziert mit der bestehenden Immomio GraphQL API für Bewerbungsdaten, Property-Informationen und Übersetzungen.

### GraphQL Client

- Library: `graphql-request` (v7+)
- Endpoint: `NEXT_PUBLIC_GRAPHQL_ENDPOINT` (Env-Variable, required)
- Header: `Content-Type: application/json`
- Lazy-initialisiert (Singleton)

### 14.1 Query: checkGuestApplication

Prüft ob eine E-Mail-Adresse sich für eine Property bewerben kann. Wird im Email-Step (Step 1) mit 500ms Debounce aufgerufen.

```graphql
query checkGuestApplication($email: String!, $propertyId: ID!) {
  checkGuestApplication(email: $email, propertyId: $propertyId) {
    applicationPossible
    alreadyRegistered
    alreadyGuest
    token
  }
}
```

**Response-Typen:**

| Feld | Typ | Bedeutung |
|---|---|---|
| `applicationPossible` | `boolean` | Bewerbung möglich? |
| `alreadyRegistered` | `boolean` | Immomio-Konto existiert → Hinweis "Bitte anmelden" |
| `alreadyGuest` | `boolean` | Gast-Bewerbung existiert → Hinweis "Bereits beworben" |
| `token` | `string \| null` | Auth-Token für `applyAsGuest` Mutation (nur bei `applicationPossible: true`) |

**Frontend-Logik:** Erst wenn `applicationPossible === true` und `token` vorhanden → "Weiter"-Button aktiv. Token wird im FormState gespeichert.

### 14.2 Query: property

Lädt alle Daten einer Immobilie für die Exposé-Seite. Vollständige Query:

```graphql
query property($id: ID!) {
  property(id: $id) {
    id
    status
    size
    externalId
    type
    totalRentGross
    entryPrice
    marketingType
    rented
    dataPrivacyUrl
    data {
      referenceId
      name
      address {
        city
        country
        region
        street
        houseNumber
        zipCode
      }
      showAddress
      basePrice
      availableFrom {
        dateAvailable
        stringAvailable
      }
      heatingCostIncluded
      size
      documents {
        url
        title
        type
        identifier
        extension
        encrypted
      }
      totalRentGross
      otherCosts
      parkingPrice
      buildingCondition
      attachments {
        url
        title
        type
        identifier
        extension
        encrypted
      }
      constructionYear
      heater
      objectType
      numberOfFloors
      bathRooms
      guestToilette
      kitchenette
      landArea
      storeRoom
      washDryRoom
      garden
      gardenUse
      attic
      ground
      bicycleRoom
      seniors
      barrierFree
      fireplace
      parkingSpaces {
        type
        price
        count
        purchasePrice
      }
      rooms
      halfRooms
      elevator
      tvSatCable
      flatType
      floor
      heatingCost
      heatingCostIncluded
      serviceCharge
      bailment
      showContact
      objectDescription {
        de
        en
      }
      objectLocationText {
        de
        en
      }
      objectMiscellaneousText {
        de
        en
      }
      furnishingDescription {
        de
        en
      }
      customerName
      customerLogo
      numberOfBalconies
      numberOfTerraces
      numberOfLoggias
      balconyTerraceArea
      numberOfBedrooms
      basementAvailable
      basementSize
      wheelchairAccessible
      energyCertificate {
        energyCertificateType
        creationDate
        primaryEnergyProvider
        primaryEnergyConsumption
        usageCertificate {
          energyConsumption
          energyEfficiencyClass
          includesHeatConsumption
        }
        demandCertificate {
          endEnergyConsumption
          energyEfficiencyClass
        }
      }
    }
    titleImage {
      url
      title
      type
      identifier
      extension
      encrypted
      index
    }
    branding {
      theme {
        name
        primaryColor
        secondaryColor
        primaryTextColor
        secondaryTextColor
        buttonTextColor
        backgroundColor
        cardBackgroundColor
        active
      }
      logoRedirectUrl
      logo {
        title
        url
        name
      }
      itpSettings {
        informalLanguage
      }
    }
    allowContinueAsGuest
    applyLink
    customer {
      id
      name
      logo
    }
    wbs
  }
}
```

### 14.3 Query: translations

Lädt i18n-Texte für Labels und Enum-Werte (z.B. Heizungsarten, Energieausweis-Typen).

```graphql
query translations($appName: String!, $langCode: String!, $informal: Boolean!) {
  translations(appName: $appName, langCode: $langCode, informal: $informal)
}
```

**Feste Parameter:** `appName: "tenant"`, `langCode: "de"`, `informal: false`

**Response:** `Record<string, string>` – Key-Value-Map (z.B. `"general.heater.LONG_DISTANCE" → "Fernwärme"`)

**Fallback:** Wenn die Translation API keine Werte liefert, sind deutsche Fallback-Labels für Heizungstypen und Energieausweistypen im Frontend hartcodiert.

### 14.4 Mutation: applyAsGuest

Sendet die komplette Bewerbung an die Immomio API. Wird in Step 5 (Dokumente) beim Absenden aufgerufen.

```graphql
mutation applyAsGuest($guestData: GuestDataInput, $token: String!) {
  applyAsGuest(guestData: $guestData, token: $token) {
    status
    statusText
  }
}
```

**`token`:** Der Token aus der `checkGuestApplication`-Response (Step 1).

**`GuestDataInput` Struktur:**

```typescript
interface GuestDataInput {
  email: string
  propertyId: string
  profileData: {
    firstname: string
    name: string                          // = lastname
    portrait?: UploadedDocument | null    // Portraitfoto (aus File Upload)
    phone: string
    householdType?: HouseholdType         // z.B. "SINGLE", "COUPLE_WITH_CHILDREN"
    residents: number
    moveInDate: string                    // YYYY-MM-DD
    guarantorExist: boolean
    furtherInformation: string
    dateOfBirth: string                   // YYYY-MM-DD
    gender: null                          // nicht erhoben im POC
    title: null                           // nicht erhoben im POC
    personalStatus: null                  // nicht erhoben im POC
    profession?: {
      type: ProfessionType                // z.B. "EMPLOYED_UNLIMITED"
      subType: string
      income: number                      // Monatsnetto in Euro
      employmentDate: null
    }
    additionalInformation: {
      animals: boolean
      housingPermission?: {
        type: string                      // HousingPermissionType enum value
        amountPeople: number
      } | null
    }
    attachments: UploadedDocument[]       // Zusammengeführt aus incomeStatement, creditReport, wbsCertificate, otherDocuments
  }
  address: {
    city: string
    zipCode: string
    street: string
    houseNumber: string
    district: null
    region: string | null                 // = Bundesland
    country: string                       // Default: "DE"
  }
  preferredLanguage: "de"
}
```

**`UploadedDocument` Struktur** (kommt aus dem File Upload Service):

```typescript
interface UploadedDocument {
  title: string
  name: string
  type: DocumentType
  documentFileType: "PDF" | "IMG"
  documentType: DocumentType | null
  identifier: string
  extension: string
  encrypted: boolean
  url: string
  bucket: string
  publicId: string
}
```

**Enum-Werte:**

| Typ | Werte |
|---|---|
| `HouseholdType` | `SINGLE`, `COUPLE_WITHOUT_CHILDREN`, `COUPLE_WITH_CHILDREN`, `SINGLE_WITH_CHILDREN`, `SHARED_APARTMENT` |
| `ProfessionType` | `EMPLOYED_UNLIMITED`, `EMPLOYED_LIMITED`, `SELF_EMPLOYED`, `CIVIL_SERVANT`, `STUDENT`, `APPRENTICE`, `RETIRED`, `LOOKING_FOR_WORK`, `HOUSEHOLD_MANAGER` |
| `DocumentType` | `IMG`, `WB_CERTIFICATE`, `INCOME_STATEMENT`, `CREDIT_REPORT`, `OTHER` |

### 14.5 FormState → GuestDataInput Mapping

Das Frontend speichert den Formular-Zustand flach (`ApplicationFormState`). Vor dem Submit wird er in die verschachtelte `GuestDataInput`-Struktur konvertiert:

| FormState-Feld | GuestDataInput-Pfad |
|---|---|
| `email` | `email` |
| `firstname` | `profileData.firstname` |
| `lastname` | `profileData.name` |
| `portrait` | `profileData.portrait` |
| `phone` | `profileData.phone` |
| `householdType` | `profileData.householdType` |
| `residents` | `profileData.residents` |
| `moveInDate` | `profileData.moveInDate` |
| `hasGuarantor` | `profileData.guarantorExist` |
| `furtherInformation` | `profileData.furtherInformation` |
| `dateOfBirth` | `profileData.dateOfBirth` |
| `professionType` | `profileData.profession.type` |
| `professionSubType` | `profileData.profession.subType` |
| `income` | `profileData.profession.income` |
| `hasAnimals` | `profileData.additionalInformation.animals` |
| `housingPermissionType` | `profileData.additionalInformation.housingPermission.type` |
| `housingPermissionAmountPeople` | `profileData.additionalInformation.housingPermission.amountPeople` |
| `incomeStatement` + `creditReport` + `wbsCertificate` + `otherDocuments` | `profileData.attachments` (zusammengeführt) |
| `street` | `address.street` |
| `houseNumber` | `address.houseNumber` |
| `zipCode` | `address.zipCode` |
| `city` | `address.city` |
| `bundesland` | `address.region` |
| `country` | `address.country` |

**Nach erfolgreichem Submit:** LocalStorage löschen (`immomio_application_form_${propertyId}`), Redirect auf `/bewerbung/erfolg?propertyId=...`

---

## 15. File Upload Service

Separater externer Dienst für Datei-Uploads (nicht Teil des eudi-wallet-service).

### Konfiguration

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_FILE_UPLOAD_ENDPOINT` | Upload-URL (required) |
| `NEXT_PUBLIC_FILE_UPLOAD_TOKEN` | Auth-Token (required) |

### Upload-Request

```
POST <NEXT_PUBLIC_FILE_UPLOAD_ENDPOINT>
Authorization: <NEXT_PUBLIC_FILE_UPLOAD_TOKEN>
Content-Type: multipart/form-data

FormData:
  files:     <File>                  // Die Datei
  filesType: "IMG" | "PDF"          // Automatisch ermittelt aus Extension
  rotations: "[]"                   // Immer leeres Array
```

**Dateitype-Erkennung:**
- Extensions `jpg`, `jpeg`, `png`, `gif`, `webp` → `"IMG"`
- Alles andere → `"PDF"`

### Upload-Response

```typescript
// Response: Array von FileUploadResponse (immer 1 Element bei Einzelupload)
[{
  title: string           // Dateiname
  name: string
  type: string
  documentFileType: string
  documentType: string | null
  identifier: string      // Eindeutige ID
  extension: string
  encrypted: boolean
  url: string             // Abruf-URL der hochgeladenen Datei
  bucket: string
  publicId: string
}]
```

### Verwendung im Bewerbungsformular

| Step | Upload-Feld | DocumentType |
|---|---|---|
| 2 (Persönliche Daten) | WBS-Zertifikat | `WB_CERTIFICATE` |
| 3 (Kontaktdaten) | Portraitfoto | `IMG` |
| 5 (Dokumente) | Einkommensnachweis | `INCOME_STATEMENT` |
| 5 (Dokumente) | Bonitätsauskunft | `CREDIT_REPORT` |
| 5 (Dokumente) | Weitere Dokumente (mehrfach) | `OTHER` |

---

## 16. Adress-Autocomplete (Nominatim)

Adress-Autocomplete in Step 3 (Kontaktdaten) über die OpenStreetMap Nominatim API.

### API-Aufruf

```
GET https://nominatim.openstreetmap.org/search?q=<query>&format=json&addressdetails=1&countrycodes=de&limit=5
Accept-Language: de
```

### Bedingungen

- **Minimale Query-Länge:** 3 Zeichen (darunter keine Anfrage)
- **Ergebnis-Limit:** 5 Vorschläge
- **Länder-Filter:** Nur Deutschland (`countrycodes=de`)

### Feld-Mapping (Nominatim → App)

| Nominatim-Feld | App-Feld | Fallback |
|---|---|---|
| `address.road` | `street` | `""` |
| `address.house_number` | `houseNumber` | `""` |
| `address.postcode` | `zipCode` | `""` |
| `address.city` | `city` | `address.town`, dann `address.village`, dann `address.municipality` |
| `address.state` | `bundesland` | `""` |
| `address.country_code` | `country` | `"DE"` (uppercase) |

> **Hinweis:** Nominatim liefert bei kleineren Orten keine `city`, sondern `town`, `village` oder `municipality`. Alle vier Felder müssen als Fallback-Kette geprüft werden.

---

## 17. WBS-System (Wohnberechtigungsschein)

Im Bewerbungsformular (Step 2, Persönliche Daten) kann der Nutzer einen Wohnberechtigungsschein angeben. Die verfügbaren Scheintypen hängen vom gewählten Bundesland ab.

### UI-Flow

1. Nutzer öffnet WBS-Dropdown → sieht 16 Bundesländer
2. Wählt Bundesland → sieht bundesweite + bundesland-spezifische Scheintypen
3. Wählt Scheintyp → Dropdown schließt sich
4. Optional: "Auswahl zurücksetzen"-Link

### Scheintypen

**Bundesweit (in allen Bundesländern verfügbar):**

| Enum-Wert | Label |
|---|---|
| `WBS` | Wohnberechtigungsschein (§5 Schein) |
| `SIXTH_PARAGRAPH_SECOND_SUPPORT_PATH` | §6-Schein (2. Förderweg) |

**Hamburg (zusätzlich):**

| Enum-Wert | Label |
|---|---|
| `URGENCY_CERTIFICATE` | Dringlichkeitsschein |
| `URGENCY_CONFIRMATION` | Dringlichkeitsbestätigung |
| `HAMBURG_SIXTEENTH_PARAGRAPH` | §16 Schein (Hamburg) |

**Berlin (zusätzlich):**

| Enum-Wert | Label |
|---|---|
| `URGENCY_CERTIFICATE` | Dringlichkeitsschein |
| `URGENCY_CONFIRMATION` | Dringlichkeitsbestätigung |
| `WBS_100` | WBS 100 |
| `WBS_140` | WBS 140 |
| `WBS_160` | WBS 160 |
| `WBS_180` | WBS 180 |
| `WBS_240` | WBS 240 |
| `WBS_SPECIAL_HOUSING_NEEDS` | WBS besonderer Wohnbedarf |

**Bayern (zusätzlich):**

| Enum-Wert | Label |
|---|---|
| `BAVARIA_EOF_INCOME_GROUP_1` | EOF Einkommensgruppe 1 |
| `BAVARIA_EOF_INCOME_GROUP_2` | EOF Einkommensgruppe 2 |
| `BAVARIA_EOF_INCOME_GROUP_3` | EOF Einkommensgruppe 3 |

**Schleswig-Holstein (zusätzlich):**

| Enum-Wert | Label |
|---|---|
| `SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_STANDARD` | §8 Standard |
| `SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_20` | §8 +20% |
| `SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_40` | §8 +40% |
| `SCHLESWIG_HOLSTEIN_EIGHTY_EIGHTH_PARAGRAPH_D_2` | §88d Abs. 2 |

**Baden-Württemberg (zusätzlich):**

| Enum-Wert | Label |
|---|---|
| `BADEN_WUERTTEMBERG_WOSU_EMERGENCY_CERTIFICATE` | Wohnungssucherschein (WOSU/Notfallschein) |

### Datenfluss

Der gewählte `HousingPermissionType` Enum-Wert wird zusammen mit `housingPermissionAmountPeople` (Anzahl Personen) an die GraphQL API gesendet als `profileData.additionalInformation.housingPermission`.

---

## 18. Exposé-Seite (Property-Daten)

Die Route `/expose` zeigt eine vollständige Wohnungsanzeige. Property-ID kommt aus dem Query-Parameter `?propertyId=...` oder fällt auf `NEXT_PUBLIC_PROPERTY_ID` zurück.

### Datenquellen

- `property(id)` Query → Immobilien-Daten (siehe [Kapitel 14.2](#142-query-property))
- `translations("tenant", "de", false)` Query → Enum-Labels

Beide Queries werden parallel beim Mount geladen.

### Dargestellte Sektionen

1. **Bilder-Slideshow:** `titleImage` + `attachments` (gefiltert nach `type === "IMAGE"` oder Bild-Extensions). Touch-Swipe-Unterstützung (min. 50px). Dot-Navigation + Pfeile.

2. **Header:** Objekttyp-Badge, Name, Adresse (nur wenn `showAddress === true`), Quick Facts (Größe m², Zimmer), Gesamtmiete.

3. **Anbieter:** Kundenname + Logo (`customer.name`, `customer.logo`).

4. **Beschreibung:** `objectDescription.de`, gekürzt auf 200 Zeichen mit "Mehr anzeigen"-Toggle.

5. **Kosten:** Grundmiete, Betriebskosten, Sonstige Kosten, Kaution, Heizkosten, Gesamtmiete (fett).

6. **Details:** Objekttyp, Objektzustand, Etage, Fußboden, Barrierefrei, Baujahr, Kellerfläche.

7. **Ausstattung:** Tags aus booleschen Feldern – Aufzug, Barrierefrei, Garten, Balkon, Terrasse, Einbauküche, Abstellraum, Wasch-/Trockenraum, Fahrradraum, Dachboden, Keller, Kamin, Gäste-WC, Rollstuhlgerecht.

8. **Energieeffizienz:** Energieausweistyp (Verbrauch/Bedarf), Energieeffizienzklasse, Energieträger, Heizungsart, Endenergieverbrauch/-bedarf (kWh/m²a), Primärenergiebedarf.

9. **Info-Boxen:** Bewerbungsprozess-Info, SCHUFA-Hinweis (Link auf `tenant.sandbox.immomio.com/static/schufa-info`).

10. **Footer:** Links zu AGB, Datenschutz, Impressum, Barrierefreiheitserklärung.

11. **Sticky "Jetzt bewerben"-Button:** Unten fixiert, verlinkt auf `/bewerbung?propertyId=...`.

### Enum-Label-Mappings (Fallback, wenn Translations fehlen)

**Objekttyp:**

| Wert | Label |
|---|---|
| `FLAT` | Wohnen |
| `HOUSE` | Haus |
| `COMMERCIAL` | Gewerbe |
| `GARAGE` | Garage |

**Objektzustand:**

| Wert | Label |
|---|---|
| `FIRST_TIME_USE` | Erstbezug |
| `FIRST_TIME_USE_AFTER_RENOVATION` | Erstbezug nach Sanierung |
| `MINT_CONDITION` | Neuwertig |
| `REFURBISHED` | Saniert |
| `MODERNIZED` | Modernisiert |
| `FULLY_RENOVATED` | Vollständig renoviert |
| `WELL_KEPT` | Gepflegt |
| `NEED_OF_RENOVATION` | Renovierungsbedürftig |

**Fußboden:**

| Wert | Label |
|---|---|
| `LAMINATE` | Laminat |
| `PARQUET` | Parkett |
| `TILES` | Fliesen |
| `CARPET` | Teppich |
| `WOOD` | Holz |
| `STONE` | Stein |
| `PVC` | PVC |
| `LINOLEUM` | Linoleum |

**Heizungsart:**

| Wert | Label |
|---|---|
| `LONG_DISTANCE` / `DISTRICT_HEATING` | Fernwärme |
| `GAS` | Gas |
| `OIL` | Öl |
| `ELECTRIC` | Strom |
| `HEAT_PUMP` | Wärmepumpe |
| `SOLAR` | Solar |
| `PELLET` | Pellet |
| `WOOD` | Holz |
| `COAL` | Kohle |
| `BLOCK` | Blockheizkraftwerk |
| `GEOTHERMAL` | Erdwärme |
| `WOOD_PELLET` | Holzpellets |
| `LIQUID_GAS` | Flüssiggas |

**Energieausweistyp:**

| Wert | Label |
|---|---|
| `USAGE_IDENTIFICATION` / `CONSUMPTION` | Verbrauchsausweis |
| `DEMAND_IDENTIFICATION` / `DEMAND` | Bedarfsausweis |

**Energieausweis-Datum:** Format `MONTH_YEAR` (z.B. `"MAY_2014"`) → wird zu `"Mai 2014"` konvertiert.

### Währungsformatierung

`de-DE` Locale, 2 Dezimalstellen, Suffix ` €` (z.B. `"1.250,00 €"`).

---

## 19. Key-Generierung & Sandbox-Onboarding

### Voraussetzungen

- Node.js >= 20
- Zugang zur BMI EUDI Wallet Sandbox

### Schritt 1: Key-Pair generieren

```bash
cd eudi-wallet-service
npm run generate-keys    # = tsx scripts/generate-keys.ts
```

Das Script erzeugt:
- **ES256 (ECDSA P-256) Key-Pair** via `jose.generateKeyPair('ES256', { extractable: true })`
- **Private Key (PKCS#8 PEM)** → als `PRIVATE_KEY` in `.env` speichern (mit `\n`-Escapes)
- **Public Key (SPKI PEM)** → in Sandbox-Formular einfügen

### Schritt 2: Access Certificate in der Sandbox erstellen

1. Sandbox-Portal öffnen (BMI EUDI Wallet)
2. "Create Access Certificate" Formular
3. Public Key (P-256) aus Schritt 1 einfügen
4. Zertifikatskette herunterladen (PEM-Format: Leaf + Intermediate)

### Schritt 3: Environment-Variablen setzen

```bash
# .env
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
CERT_CHAIN="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
SERVICE_URL=https://your-service.up.railway.app
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
TRUST_LIST_URL=https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists
PORT=3001
```

> **WICHTIG:** PEM-Strings in Env-Variablen: Newlines als `\n` Escape-Sequenzen speichern (nicht als echte Newlines). Der Service ersetzt `\\n` → `\n` beim Start.

### Schritt 4: client_id Verifikation

Die `client_id` wird automatisch beim Start berechnet aus dem Leaf-Zertifikat in `CERT_CHAIN`:
```
x509_hash:<base64url(SHA-256(Leaf-Cert-DER))>
```
Sie wird geloggt beim Startup. Verifizieren, dass sie mit dem Sandbox-Thumbprint übereinstimmt.

### Deployment (Railway)

```toml
# railway.toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 60
startCommand = "npm start"
```

- Railway setzt `PORT` automatisch
- `SERVICE_URL` muss auf die Railway-Domain zeigen (z.B. `https://eudi-wallet-service-production.up.railway.app`)
- PEM-Strings in Railway UI eingeben (mit `\n` Escapes)

---

## Anhang C: Hardcoded Werte (Zusammenfassung)

| Wert | Verwendung |
|---|---|
| `600` Sekunden | `expires_in` für Access Token |
| `300` Sekunden | `c_nonce_expires_in` überall |
| `10` Minuten | VP Session TTL |
| `15` Minuten | Issuance Session TTL, Return URL TTL |
| `5` Minuten | Session Cleanup Intervall |
| `24` Stunden | Trust List Cache TTL |
| `2` Sekunden | Frontend Poll-Intervall |
| `3` Minuten | Frontend Poll-Timeout |
| `2.000.000` Bytes | Max JWE Size |
| `1.000.000` Bytes | Max unverschlüsselter VP Token |
| `60` Sekunden | Clock-Skew-Toleranz (Layer 2) |
| `365` Tage | Credential Gültigkeit |
| `1000–9999` | tx_code Wertebereich |
