# EUDI Wallet Service – Migrationsdokumentation

> **Zweck:** Technisch vollständige Dokumentation des `eudi-wallet-service/` für die Migration auf einen anderen Tech Stack.
> **Stand:** März 2026

---

## 1. Überblick

Der EUDI Wallet Service ist ein **OpenID4VP Relying Party Backend** und ein **OpenID4VCI Credential Issuer**. Er ermöglicht es Nutzern, verifizierte Identitätsdaten (PID – Person Identification Data) aus einer EUDI Wallet App kryptographisch gesichert an ein Frontend zu übertragen. Darüber hinaus kann er Electronic Attestations of Attributes (EAA) als SD-JWT-VC Credentials in die EUDI Wallet ausstellen.

**Protokolle:** OpenID for Verifiable Presentations (OpenID4VP) und OpenID for Verifiable Credential Issuance (OpenID4VCI), gemäß eIDAS 2.0 / ARF
**Credential-Formate:** SD-JWT (Selective Disclosure JWT), Format-ID `dc+sd-jwt` (Verifikation) und `vc+sd-jwt` (Issuance)
**Client-ID-Schema:** `x509_hash` (HAIP-konform)

---

## 2. Architektur

### 2.1 Verifiable Presentation (OpenID4VP)

```
┌──────────────────────┐         ┌─────────────────────────────┐
│   Frontend (Next.js) │         │   EUDI Wallet Service       │
│   localhost:3000     │         │   Railway (Port 8080)       │
└──────────┬───────────┘         └──────────────┬──────────────┘
           │                                     │
           │  POST /initiate                     │
           │────────────────────────────────────>│  ① Session + Nonce + Ephemeral Keypair
           │<────────────────────────────────────│     generieren, JAR erstellen
           │  { sessionId, walletUrl }           │
           │                                     │
     ┌─────┴─────┐                               │
     │ QR-Code   │ oder Deep Link                │
     │ anzeigen  │ öffnen (Mobile)               │
     └─────┬─────┘                               │
           │                                     │
           │              ┌──────────────┐       │
           │              │ EUDI Wallet  │       │
           │              │ App (Handy)  │       │
           │              └──────┬───────┘       │
           │                     │               │
           │                     │  GET /request/:sessionId
           │                     │──────────────>│  ② Signierter JAR (JWT) an Wallet
           │                     │<──────────────│     liefern
           │                     │               │
           │                     │  [User gibt   │
           │                     │   Daten frei] │
           │                     │               │
           │                     │  POST /callback/:sessionId
           │                     │──────────────>│  ③ VP Token empfangen, JWE entschlüsseln,
           │                     │<──────────────│     7-Schichten-Validierung, PID extrahieren
           │                     │  { redirect_uri }
           │                     │               │
           │                     │  GET /done/:sessionId
           │                     │──────────────>│  ④ Erfolgsseite / window.close()
           │                     │               │
           │  GET /result/:sessionId (Polling)   │
           │────────────────────────────────────>│  ⑤ PID-Claims zurückgeben
           │<────────────────────────────────────│
           │  { status, pidClaims }              │
           │                                     │
     Formularfelder befüllen                     │
```

### 2.2 Credential Issuance (OpenID4VCI)

```
┌──────────────────────┐         ┌─────────────────────────────┐
│   Frontend (Next.js) │         │   EUDI Wallet Service       │
│   /ausstellen        │         │   Railway (Port 8080)       │
└──────────┬───────────┘         └──────────────┬──────────────┘
           │                                     │
           │  POST /issuer/initiate              │
           │────────────────────────────────────>│  ① VP-Session + Issuance-Session
           │<────────────────────────────────────│     erstellen
           │  { sessionId, vpSessionId, walletUrl}│
           │                                     │
     ┌─────┴─────┐                               │
     │ QR-Code   │ (openid4vp://)                │
     └─────┬─────┘                               │
           │              ┌──────────────┐       │
           │              │ EUDI Wallet  │       │
           │              └──────┬───────┘       │
           │                     │  GET /request/:vpId
           │                     │──────────────>│  ② PID-JAR liefern
           │                     │<──────────────│
           │                     │  POST /callback/:vpId
           │                     │──────────────>│  ③ PID validieren, auto-link
           │                     │               │     zu Issuance-Session
           │                                     │
           │  GET /issuer/result/:id (Polling)   │
           │────────────────────────────────────>│  ④ pid_verified + pidClaims
           │<────────────────────────────────────│
           │                                     │
     Credential-Vorschau anzeigen                │
           │                                     │
           │  POST /issuer/create-offer/:id      │
           │────────────────────────────────────>│  ⑤ Credential Offer erstellen
           │<────────────────────────────────────│
           │  { walletUrl }                      │
           │                                     │
     ┌─────┴─────┐                               │
     │ QR-Code   │ (openid-credential-offer://)  │
     └─────┬─────┘                               │
           │              ┌──────────────┐       │
           │              │ EUDI Wallet  │       │
           │              └──────┬───────┘       │
           │                     │  GET /issuer/offer/:id
           │                     │──────────────>│  ⑥ Credential Offer JSON
           │                     │  GET /.well-known/*
           │                     │──────────────>│  ⑦ Issuer + Auth Metadata
           │                     │  POST /issuer/token
           │                     │──────────────>│  ⑧ Pre-Auth Code → Token
           │                     │  POST /issuer/credential
           │                     │──────────────>│  ⑨ Proof → SD-JWT-VC
           │                     │<──────────────│
           │                                     │
           │  GET /issuer/result/:id (Polling)   │
           │────────────────────────────────────>│  ⑩ status: issued
           │<────────────────────────────────────│
```

---

## 3. Endpunkte (API-Spezifikation)

### 3.1 `GET /health`

Health-Check.

**Response** `200`:
```json
{
  "status": "ok",
  "timestamp": "2026-03-05T10:30:00.000Z"
}
```

---

### 3.2 `POST /initiate`

Erstellt eine neue Wallet-Präsentations-Session.

**Request Body** (optional, JSON):
```json
{
  "returnUrl": "http://192.168.1.100:3000"
}
```

`returnUrl` wird nur von Mobile-Geräten gesendet. Ermöglicht, dass `/done/` den Wallet-Tab nach Präsentation schließt (same-device flow).

**Interne Schritte:**
1. UUID v4 als `sessionId` generieren
2. 32 Byte cryptographisch zufälligen `nonce` generieren (base64url-kodiert)
3. Ephemeral ECDH-ES P-256 Keypair generieren (für JWE-Verschlüsselung der Wallet-Antwort)
4. Public Key als JWK exportieren, `kid` (UUID), `use: "enc"`, `alg: "ECDH-ES"` setzen
5. Signierten JAR (JWT Authorization Request) erstellen (siehe Abschnitt 4)
6. Session im Store speichern (TTL: 10 Minuten)
7. Optional: `returnUrl` in separater Map speichern (TTL: 15 Minuten)
8. `client_id` berechnen: `x509_hash:<base64url(SHA256(leaf_cert_DER))>`
9. `walletUrl` bauen: `openid4vp://?client_id=<encoded>&request_uri=<SERVICE_URL>/request/<sessionId>`

**Response** `200`:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "walletUrl": "openid4vp://?client_id=x509_hash%3A<thumbprint>&request_uri=https%3A%2F%2Fservice.railway.app%2Frequest%2F550e8400-..."
}
```

---

### 3.3 `GET /request/:sessionId`

Wallet-App ruft diesen Endpunkt ab, um den signierten JAR zu erhalten.

**URL-Parameter:**
- `sessionId` – Session-ID aus `/initiate`

**Fehler-Responses:**
- `404` – Session nicht gefunden
- `410` – Session abgelaufen

**Erfolg-Response** `200`:
- **Content-Type:** `application/oauth-authz-req+jwt`
- **Cache-Control:** `no-store`
- **Body:** Kompakter JWT (siehe Abschnitt 4 für JAR-Struktur)

---

### 3.4 `POST /callback/:sessionId`

Wallet schickt den VP Token (verschlüsselt als JWE) an diesen Endpunkt.

**URL-Parameter:**
- `sessionId` – Session-ID

**Request Formate:**

Format 1 – `application/x-www-form-urlencoded` (Standard, `direct_post.jwt`):
```
response=<JWE-String>
```
Das `response`-Feld enthält einen kompakten JWE, verschlüsselt mit dem ephemeral Public Key aus dem JAR.

Format 2 – `application/json` (Fallback):
```json
{
  "vp_token": "<SD-JWT-String>"
}
```

**Interne Schritte:**
1. Session validieren (existiert, nicht abgelaufen)
2. Body parsen (form-urlencoded oder JSON)
3. `validateVpToken()` aufrufen (7-Schichten-Validierung, siehe Abschnitt 5)
4. Bei Erfolg: Session auf `complete` setzen, PID-Claims speichern
5. Bei Fehler: Session auf `error` setzen, Fehlermeldung speichern

**Erfolg-Response** `200`:
```json
{
  "redirect_uri": "https://service.railway.app/done/550e8400-..."
}
```

Die Wallet-App öffnet diese URL im Browser.

**Fehler-Response** `400`:
```json
{
  "error": "[Layer 4] Key binding nonce mismatch"
}
```

---

### 3.5 `GET /done/:sessionId`

Wird vom Wallet-Browser nach der Präsentation geöffnet.

**URL-Parameter:**
- `sessionId` – Session-ID

**Verhalten:**

- **Same-Device** (returnUrl vorhanden): HTML-Seite mit `<script>window.close();</script>` im `<head>` → Tab schließt sich sofort, Bewerbungs-Tab kommt in den Vordergrund.

- **Cross-Device** (kein returnUrl): Statische grüne Erfolgsseite mit Text "Authentifizierung abgeschlossen. Ihre Daten wurden erfolgreich übertragen. Sie können dieses Fenster schließen."

**Bestimmung Same-Device vs Cross-Device:** Prüft ob `getReturnUrl(sessionId)` einen Wert zurückgibt. Die `returnUrl` wird in einer separaten Map mit 15-min TTL gespeichert, die unabhängig vom Session-Lifecycle ist.

---

### 3.6 `GET /result/:sessionId`

Frontend pollt diesen Endpunkt alle 2 Sekunden.

**URL-Parameter:**
- `sessionId` – Session-ID

**Responses:**

Pending (`202`):
```json
{
  "status": "pending"
}
```

Complete (`200`):
```json
{
  "status": "complete",
  "pidClaims": {
    "given_name": "Max",
    "family_name": "Mustermann",
    "birthdate": "1990-01-15",
    "street_address": "Musterstraße 42",
    "postal_code": "10115",
    "locality": "Berlin",
    "country": "DE"
  }
}
```

Error (`400`):
```json
{
  "status": "error",
  "errorMessage": "[Layer 7] given_name is empty or missing"
}
```

Not Found (`404`):
```json
{
  "error": "Session not found"
}
```

Expired (`410`):
```json
{
  "error": "Session expired"
}
```

**Wichtig:** Nach Abruf einer `complete`- oder `error`-Session wird die Session gelöscht. Der Endpunkt ist also einmalig abrufbar.

---

### 3.7 OpenID4VCI Issuer Endpoints

#### 3.7.1 `GET /.well-known/openid-credential-issuer`

Issuer Metadata gemäß OpenID4VCI. Enthält Credential Configurations, Endpoint URLs, Display Names und unterstützte Formate.

**Response** `200`:
```json
{
  "credential_issuer": "https://service.railway.app",
  "credential_endpoint": "https://service.railway.app/issuer/credential",
  "nonce_endpoint": "https://service.railway.app/issuer/nonce",
  "credential_configurations_supported": {
    "wohnungsgeberbestaetigung": {
      "format": "vc+sd-jwt",
      "vct": "urn:eaa:wohnungsgeberbestaetigung:de:1",
      "claims": { "...": "..." },
      "display": [{ "name": "Wohnungsgeberbest\u00e4tigung", "locale": "de-DE" }]
    },
    "genossenschaft-mitglied": {
      "format": "vc+sd-jwt",
      "vct": "urn:eaa:genossenschaft-mitglied:de:1",
      "claims": { "...": "..." },
      "display": [{ "name": "Genossenschaft Mitgliedsausweis", "locale": "de-DE" }]
    }
  }
}
```

Listet beide Credential-Typen mit Claims und Display Labels.

---

#### 3.7.2 `GET /.well-known/oauth-authorization-server`

OAuth Authorization Server Metadata.

**Response** `200`:
```json
{
  "issuer": "https://service.railway.app",
  "token_endpoint": "https://service.railway.app/issuer/token",
  "grant_types_supported": ["urn:ietf:params:oauth:grant-type:pre-authorized_code"]
}
```

---

#### 3.7.3 `POST /issuer/initiate`

Erstellt eine VP-Session (für PID-Verifikation) und eine Issuance-Session, verknüpft beide.

**Request Body** (JSON):
```json
{
  "credentialType": "wohnungsgeberbestaetigung",
  "returnUrl": "http://192.168.1.100:3000"
}
```

- `credentialType` – Pflicht: `'wohnungsgeberbestaetigung'` oder `'genossenschaft-mitglied'`
- `returnUrl` – Optional: für Same-Device Flow

**Interne Schritte:**
1. Issuance-Session erstellen (Status: `pending_pid`, TTL: 15 min)
2. VP-Session erstellen (für PID-Abfrage), `issuanceSessionId` in Session speichern
3. JAR für PID-Abfrage generieren
4. `walletUrl` mit `openid4vp://` bauen

**Response** `200`:
```json
{
  "sessionId": "issuance-session-uuid",
  "vpSessionId": "vp-session-uuid",
  "walletUrl": "openid4vp://?client_id=x509_hash%3A...&request_uri=https%3A%2F%2Fservice.railway.app%2Frequest%2Fvp-session-uuid"
}
```

---

#### 3.7.4 `POST /issuer/link-pid`

Fallback-Endpunkt, um PID-Claims manuell mit einer Issuance-Session zu verknüpfen. Im Normalfall erfolgt die Verknüpfung automatisch im Callback über `issuanceSessionId`.

**Request Body** (JSON):
```json
{
  "issuanceSessionId": "issuance-session-uuid",
  "vpSessionId": "vp-session-uuid"
}
```

**Interne Schritte:**
1. VP-Session laden und prüfen (Status: `complete`)
2. PID-Claims aus VP-Session in Issuance-Session übertragen
3. Issuance-Session auf `pid_verified` setzen

**Response** `200`:
```json
{
  "status": "pid_verified"
}
```

---

#### 3.7.5 `POST /issuer/create-offer/:sessionId`

Erstellt ein Credential Offer mit `openid-credential-offer://` URI.

**URL-Parameter:**
- `sessionId` – Issuance-Session-ID

**Voraussetzung:** Session muss Status `pid_verified` haben.

**Interne Schritte:**
1. Pre-Authorized Code generieren (32 Bytes, base64url)
2. Credential Offer Object erstellen
3. Session auf `offer_created` setzen

**Response** `200`:
```json
{
  "sessionId": "issuance-session-uuid",
  "credentialOfferUri": "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fservice.railway.app%2Fissuer%2Foffer%2Fissuance-session-uuid",
  "walletUrl": "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fservice.railway.app%2Fissuer%2Foffer%2Fissuance-session-uuid"
}
```

---

#### 3.7.6 `GET /issuer/offer/:sessionId`

Wallet ruft diesen Endpunkt ab, um das Credential Offer JSON zu erhalten.

**URL-Parameter:**
- `sessionId` – Issuance-Session-ID

**Response** `200`:
```json
{
  "credential_issuer": "https://service.railway.app",
  "credential_configuration_ids": ["wohnungsgeberbestaetigung"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "<base64url(32 random bytes)>"
    }
  }
}
```

---

#### 3.7.7 `POST /issuer/token`

Wallet tauscht Pre-Authorized Code gegen Access Token und c_nonce.

**Request Formate:**

Format 1 – `application/x-www-form-urlencoded`:
```
grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code&pre-authorized_code=<code>
```

Format 2 – `application/json`:
```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:pre-authorized_code",
  "pre-authorized_code": "<code>"
}
```

**Interne Schritte:**
1. Pre-Authorized Code validieren (Session-Lookup)
2. Access Token generieren
3. c_nonce generieren
4. Token und Nonce in Session speichern

**Response** `200`:
```json
{
  "access_token": "<generated-token>",
  "token_type": "Bearer",
  "expires_in": 86400,
  "c_nonce": "<generated-nonce>",
  "c_nonce_expires_in": 86400
}
```

---

#### 3.7.8 `POST /issuer/credential`

Wallet fordert das Credential an. Validiert Proof-of-Possession, erstellt SD-JWT-VC.

**Auth:** `Bearer <access_token>`

**Request Body** (JSON):
```json
{
  "format": "vc+sd-jwt",
  "proof": {
    "proof_type": "jwt",
    "jwt": "<proof-jwt>"
  }
}
```

**Interne Schritte:**
1. Access Token validieren (Session-Lookup)
2. c_nonce prüfen (nicht abgelaufen)
3. Proof JWT validieren (Signatur, `nonce` = c_nonce, `aud` = credential_issuer)
4. Holder Public Key aus Proof JWT Header (`jwk`) extrahieren
5. SD-JWT-VC erstellen (siehe Credential Builder)
6. Session auf `issued` setzen

**Response** `200`:
```json
{
  "credential": "<sd-jwt-vc-string>",
  "format": "vc+sd-jwt",
  "c_nonce": "<new-nonce>",
  "c_nonce_expires_in": 86400
}
```

---

#### 3.7.9 `POST /issuer/nonce`

Gibt einen frischen c_nonce zurück.

**Response** `200`:
```json
{
  "c_nonce": "<generated-nonce>",
  "c_nonce_expires_in": 86400
}
```

---

#### 3.7.10 `GET /issuer/result/:sessionId`

Frontend pollt diesen Endpunkt für den Issuance-Status.

**URL-Parameter:**
- `sessionId` – Issuance-Session-ID

**Responses:**

Pending PID (`202`):
```json
{
  "status": "pending_pid"
}
```

Offer Created (`202`):
```json
{
  "status": "offer_created"
}
```

PID Verified (`200`):
```json
{
  "status": "pid_verified",
  "pidClaims": {
    "given_name": "Max",
    "family_name": "Mustermann",
    "birthdate": "1990-01-15",
    "street_address": "Musterstraße 42",
    "postal_code": "10115",
    "locality": "Berlin",
    "country": "DE"
  }
}
```

Issued (`200`):
```json
{
  "status": "issued"
}
```

Error (`400`):
```json
{
  "status": "error",
  "errorMessage": "PID verification failed"
}
```

**Wichtig:** Nach Abruf eines Terminal-Status (`issued` oder `error`) wird die Session gelöscht.

---

## 4. JAR (JWT Authorization Request) – Struktur

Der JAR wird mit dem Access Certificate Private Key signiert und enthält alles, was die Wallet braucht, um die Präsentation durchzuführen.

### 4.1 Protected Header

```json
{
  "alg": "ES256",
  "typ": "oauth-authz-req+jwt",
  "x5c": [
    "<base64-DER-Leaf-Certificate>",
    "<base64-DER-Intermediate-CA>"
  ]
}
```

- `alg`: ES256 (ECDSA mit P-256 und SHA-256)
- `typ`: OAuth Authorization Request JWT
- `x5c`: Zertifikatskette – Leaf + Intermediate CA (German Registrar), jeweils als base64-kodierter DER

### 4.2 Payload

```json
{
  "aud": "https://self-issued.me/v2",
  "iat": 1709640000,
  "client_id": "x509_hash:<base64url(SHA256(leaf_cert_DER))>",
  "response_type": "vp_token",
  "response_mode": "direct_post.jwt",
  "nonce": "<base64url(32 random bytes)>",
  "state": "<sessionId>",
  "response_uri": "https://service.railway.app/callback/<sessionId>",
  "dcql_query": {
    "credentials": [
      {
        "id": "pid-sd-jwt",
        "format": "dc+sd-jwt",
        "meta": {
          "vct_values": ["urn:eudi:pid:de:1"]
        },
        "claims": [
          { "path": ["given_name"] },
          { "path": ["family_name"] },
          { "path": ["birthdate"] },
          { "path": ["address"] }
        ]
      }
    ],
    "credential_sets": [
      {
        "options": [["pid-sd-jwt"]],
        "required": true
      }
    ]
  },
  "client_metadata": {
    "jwks": {
      "keys": [
        {
          "kty": "EC",
          "crv": "P-256",
          "x": "...",
          "y": "...",
          "kid": "<random-uuid>",
          "use": "enc",
          "alg": "ECDH-ES"
        }
      ]
    },
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

### 4.3 Wichtige Hinweise zur Wallet-Kompatibilität

- **`vp_formats_supported`** (nicht `vp_formats`) – die Wallet liest diesen exakten Feldnamen
- **`encrypted_response_enc_values_supported`** – die Wallet liest NICHT `authorization_encrypted_response_alg/enc`
- **Ephemeral JWK** muss `kid` und `alg` haben – Wallet filtert Keys ohne diese Felder heraus
- **`dcql_query`** fordert `address` als Top-Level-Claim an (nicht die Unterfelder einzeln)
- **Nur `dc+sd-jwt`** wird angefordert (kein `mso_mdoc`), um ISO 18013-5 Reader Auth zu vermeiden

### 4.4 Client-ID-Berechnung

```
client_id = "x509_hash:" + base64url(SHA256(leaf_certificate_DER))
```

Schritte:
1. PEM-Zertifikatskette parsen → erstes (Leaf-)Zertifikat extrahieren
2. Base64 des PEM-Blocks dekodieren → DER-Bytes
3. SHA-256 über die DER-Bytes berechnen
4. Ergebnis base64url-kodieren
5. `"x509_hash:"` voranstellen

---

## 5. VP Token Validierung (7 Schichten)

Die Validierung erfolgt sequentiell (fail-fast). Bei Fehler wird eine `ValidationError` mit Layer-Nummer geworfen.

### Layer 1: Transport & Struktur

**Zweck:** Entschlüsselung und Extraktion des `vp_token` aus verschiedenen Formaten.

**Schritte:**
1. Falls `_encryptedResponse` vorhanden (direct_post.jwt):
   - Größencheck: max 2 MB
   - JWE mit ephemeral Private Key entschlüsseln (`compactDecrypt`)
   - Entschlüsselten Inhalt parsen:
     - **JSON mit `vp_token` als String** → direkt verwenden
     - **JSON mit `vp_token` als Object** (DCQL-Format) → erstes Credential aus dem Object extrahieren (z.B. `{ "pid-sd-jwt": ["eyJ..."] }` → `"eyJ..."`)
     - **JARM JWT** (nicht JSON-parsebar) → `decodeJwt()`, dann `vp_token` aus Payload
     - **JSON Serialized JWS** (hat `payload`-Feld) → base64url-decode, dann `vp_token`
     - **Raw SD-JWT** → direkt als Token verwenden
2. Falls kein verschlüsselter Response: `vp_token` direkt aus Body (max 1 MB)

### Layer 2: Session Binding

**Zweck:** Sicherstellen, dass der VP Token zu dieser Session gehört.

**Prüfungen:**
- `nonce` im Payload muss mit Session-Nonce übereinstimmen
- `aud` muss `client_id` oder `SERVICE_URL` sein
- `iat` darf nicht in der Zukunft liegen (Toleranz: 60 Sekunden)
- `exp` darf nicht abgelaufen sein

**Fallback:** Wenn der VP Token kein äußerer JWT ist (direkt ein SD-JWT), wird ein synthetischer Payload mit Session-Nonce und Client-ID erstellt, um die Prüfung zu bestehen.

### Layer 3: Credential Assurance

**Zweck:** Issuer-Signatur und Vertrauen prüfen.

**Schritte:**
1. Issuer JWT (erster Teil des SD-JWT vor `~`) extrahieren
2. Protected Header und Payload dekodieren
3. `exp` prüfen (Credential nicht abgelaufen)
4. Issuer-Zertifikat (`x5c` im Header) gegen Trust List prüfen
   - **Sandbox-Modus:** Prüfung wird geloggt, aber nicht enforced
   - **Produktion:** Zertifikats-Thumbprint kryptographisch gegen `pid-provider` Trust List verifizieren

### Layer 4: Holder Binding

**Zweck:** Sicherstellen, dass der Presenter der legitime Credential-Inhaber ist.

**Schritte:**
1. Letzten nicht-leeren Teil des SD-JWT extrahieren (KB-JWT = Key Binding JWT)
2. Protected Header prüfen: `typ` muss `"kb+jwt"` sein
3. `nonce` im KB-JWT Payload muss mit Session-Nonce übereinstimmen
4. **Produktion:** Signatur des KB-JWT mit dem im SD-JWT gebundenen Public Key des Holders verifizieren

### Layer 5: Wallet Integrity

**Zweck:** Wallet-Attestation gegen Trust List prüfen.

**Schritte:**
1. `wallet_attestation` oder `wal` Feld im VP Token Payload suchen
2. Falls vorhanden: gegen `wallet-provider` Trust List prüfen
   - **Sandbox-Modus:** Nur Logging, nicht enforced
   - **Produktion:** Attestation JWT Signatur verifizieren

### Layer 6: Selective Disclosure

**Zweck:** SD-JWT Format und Disclosures prüfen.

**Schritte:**
1. SD-JWT anhand von `~` splitten
2. Mindestens 2 Teile erforderlich (Issuer JWT + mindestens 1 Disclosure)
3. Disclosures sind alle Teile zwischen Issuer JWT (Index 0) und KB-JWT (letzter Index)
4. Mindestens 1 Disclosure muss vorhanden sein

### Layer 7: Business Rules

**Zweck:** Anwendungsspezifische Pflichtfelder prüfen.

**Prüfungen:**
- `given_name` muss nicht-leer sein
- `family_name` muss nicht-leer sein
- `birthdate` muss nicht-leer sein
- `birthdate` muss Format `YYYY-MM-DD` haben (Regex: `/^\d{4}-\d{2}-\d{2}$/`)

---

## 6. PID-Claims Extraktion (SD-JWT Parsing)

### 6.1 SD-JWT Struktur

```
<issuer_jwt>~<disclosure_1>~<disclosure_2>~...~<kb_jwt>
```

- **Issuer JWT:** Signierter JWT mit den kryptographisch geschützten Claims (enthält `_sd` Hashes)
- **Disclosures:** Base64url-kodierte JSON-Arrays mit den offengelegten Werten
- **KB-JWT:** Key Binding JWT (Holder Binding)

### 6.2 Disclosure-Format

Jede Disclosure ist ein base64url-kodiertes JSON-Array:

```json
["<salt>", "<claim_name>", <claim_value>]
```

Beispiel:
```
base64url(["r4nd0m_salt", "given_name", "Max"])
```

### 6.3 Extraktionslogik

1. SD-JWT anhand von `~` splitten
2. Issuer JWT (Index 0) dekodieren → Base-Claims (z.B. `iss`, `iat`, `cnf`)
3. Disclosures (Index 1 bis n-1) jeweils base64url-dekodieren und JSON-parsen
4. Claim-Name und Claim-Wert extrahieren → `Record<string, unknown>`
5. Disclosed Claims über Issuer-Payload mergen (Disclosures haben Vorrang)
6. Adress-Felder auflösen:
   - `address` Objekt kann eigene Sub-Felder haben (`street_address`, `postal_code`, `locality`)
   - Bei rekursiver Selective Disclosure: Adress-Unterfelder können als separate Top-Level-Disclosures erscheinen
   - Beide Lokationen prüfen: `address.street_address` UND `claims.street_address`

### 6.4 Ergebnis-Mapping

```
SD-JWT Claim            → PidClaims Feld        → Typ
─────────────────────────────────────────────────────────
given_name              → given_name             → string (required)
family_name             → family_name            → string (required)
birthdate               → birthdate              → string (required, YYYY-MM-DD)
address.street_address  → street_address         → string | undefined
address.postal_code     → postal_code            → string | undefined
address.locality        → locality               → string | undefined
address.country         → country                → string | undefined
```

---

## 7. Session Management

### 7.1 Session State

```
SessionState {
  nonce: string                    // 32 Bytes, base64url-kodiert
  ephemeralPrivateKey: CryptoKey   // P-256 ECDH-ES, für JWE-Entschlüsselung
  ephemeralPublicKeyJwk: JWK       // Im JAR an Wallet gesendet
  createdAt: number                // Unix-Timestamp (ms)
  expiresAt: number                // createdAt + 10 Minuten
  status: 'pending' | 'complete' | 'error'
  pidClaims?: PidClaims            // Gesetzt wenn status = 'complete'
  errorMessage?: string            // Gesetzt wenn status = 'error'
}
```

### 7.2 Lifecycle

```
POST /initiate
  → Session erstellen (status: pending, TTL: 10 min)
  → Optional: returnUrl in separater Map speichern (TTL: 15 min)

POST /callback/:id
  → Session auf 'complete' oder 'error' setzen

GET /result/:id
  → Bei 'complete' oder 'error': Session löschen nach Rückgabe
  → Bei 'pending': Session bleibt bestehen

Hintergrund-Bereinigung:
  → Alle 5 Minuten: abgelaufene Sessions (expiresAt < now) löschen
  → returnUrls: automatisch nach 15 Minuten via setTimeout gelöscht
```

### 7.3 Zwei separate Stores

| Store | Key | Value | TTL | Bereinigung |
|-------|-----|-------|-----|-------------|
| `sessions` | sessionId | SessionState | 10 min (expiresAt) | Intervall alle 5 min |
| `returnUrls` | sessionId | URL string | 15 min | setTimeout pro Eintrag |

**Grund für Trennung:** `/result/` löscht die Session nach Abruf. `/done/` wird vom Wallet-Browser ggf. danach aufgerufen und muss die `returnUrl` noch lesen können. Deshalb lebt `returnUrl` unabhängig und länger.

### 7.4 Für Produktion

- Sessions in **Redis** oder vergleichbarem Store
- Session-Daten serialisierbar machen (CryptoKey → JWK speichern, bei Bedarf re-importieren)
- returnUrls ebenfalls in Redis mit TTL

### 7.5 Issuance Session State

```
IssuanceSessionState {
  credentialType: CredentialType         // 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'
  preAuthorizedCode: string              // 32 Bytes, base64url
  accessToken?: string                   // gesetzt nach Token Exchange
  cNonce?: string                        // gesetzt nach Token Exchange
  cNonceExpiresAt?: number               // cNonce Ablaufzeit (Unix ms)
  pidClaims?: PidClaims                  // gesetzt nach PID-Verifikation
  holderPublicKeyJwk?: JWK              // gesetzt nach Credential-Ausstellung
  createdAt: number                      // Unix-Timestamp (ms)
  expiresAt: number                      // createdAt + 15 Minuten
  status: 'pending_pid' | 'pid_verified' | 'offer_created' | 'issued' | 'error'
  errorMessage?: string
}
```

**Lifecycle:**

```
POST /issuer/initiate → pending_pid (TTL 15 min)
POST /callback/:vpId → pid_verified (auto-link via issuanceSessionId)
POST /issuer/create-offer → offer_created
POST /issuer/token → (no status change, tokens stored)
POST /issuer/credential → issued
GET /issuer/result → terminal states delete session
```

**Verknüpfung mit VP-Session:** `SessionState` hat ein optionales Feld `issuanceSessionId?: string`. Wenn gesetzt, wird nach erfolgreicher PID-Validierung im Callback die zugehörige Issuance-Session automatisch auf `pid_verified` gesetzt und die PID-Claims übertragen.

---

## 8. Trust List Management

### 8.1 Externe Quellen

| List | URL | Inhalt |
|------|-----|--------|
| PID Provider | `<TRUST_LIST_URL>/pid-provider.jwt` | Vertrauenswürdige PID-Aussteller |
| Wallet Provider | `<TRUST_LIST_URL>/wallet-provider.jwt` | Vertrauenswürdige Wallet-Apps |

Standard-URL: `https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists`

### 8.2 Format

- JAdES JWT (signierte Trust List)
- Payload enthält `entries` oder `keys` Array
- Jeder Eintrag hat ein `x5t#S256` Feld (SHA-256 Thumbprint des Zertifikats)

### 8.3 Caching

- Trust Lists werden beim Server-Start geladen (blockierend)
- 24 Stunden TTL im RAM-Cache
- Bei Fehler: leere Listen → Validator loggt Warnungen, blockiert aber nicht

---

## 9. Kryptographische Algorithmen

| Algorithmus | Verwendung | Library |
|-------------|------------|---------|
| **ES256** (ECDSA P-256 + SHA-256) | JAR signieren, VP Token Signatur verifizieren, KB-JWT Signatur | jose |
| **ECDH-ES** (P-256) | Ephemeral Keypair für JWE Response-Verschlüsselung | jose |
| **A128GCM / A256GCM** | AES-GCM Content Encryption im JWE | jose |
| **SHA-256** | Zertifikats-Thumbprint für client_id, Trust List Matching | node:crypto |
| **Base64url** | JWK-Kodierung, SD-JWT Disclosures, Nonce | node:crypto / jose |

### 9.1 Schlüsselmaterial

| Schlüssel | Typ | Herkunft | Lebensdauer |
|-----------|-----|----------|-------------|
| Access Certificate Private Key | P-256 PKCS#8 PEM | Einmalig generiert (`generate-keys.ts`) | Permanent (bis Cert erneuert) |
| Certificate Chain | X.509 PEM (Leaf + Intermediate) | EUDI Sandbox | Permanent (bis Cert erneuert) |
| Ephemeral Encryption Keypair | P-256 ECDH-ES | Pro Session generiert | Session-Lebensdauer (10 min) |

### 9.2 Credential Builder (SD-JWT-VC Erstellung)

Der Credential Builder erstellt SD-JWT-VC Credentials für die Issuance.

**Library:** `@sd-jwt/core` – `SDJwtInstance.issue()`

**Signer-Bridge:** `crypto.subtle.sign(ECDSA, SHA-256)` wird auf den `@sd-jwt/core` Signer adaptiert. Der Native Web Crypto Signer wird in das Callback-Format von `@sd-jwt/core` überführt.

**JWT Header:**
```json
{
  "typ": "vc+sd-jwt",
  "alg": "ES256",
  "x5c": [
    "<base64-DER-Leaf-Certificate>",
    "<base64-DER-Intermediate-CA>"
  ]
}
```

**Selective Disclosure:** Alle Claim-Felder werden in den `_sd` DisclosureFrame aufgenommen, sodass jeder Claim einzeln selektiv offengelegt werden kann.

**Credential-Typen:**

| Typ | VCT Identifier | Beschreibung |
|-----|----------------|--------------|
| `wohnungsgeberbestaetigung` | `urn:eaa:wohnungsgeberbestaetigung:de:1` | Wohnungsgeberbestätigung |
| `genossenschaft-mitglied` | `urn:eaa:genossenschaft-mitglied:de:1` | Genossenschaft Mitgliedsausweis |

**Credential Payload Struktur:**
```json
{
  "vct": "urn:eaa:wohnungsgeberbestaetigung:de:1",
  "iss": "https://service.railway.app",
  "iat": 1709640000,
  "exp": 1741176000,
  "cnf": {
    "jwk": { "...holder public key..." }
  },
  "_sd": ["...hashed disclosures..."]
}
```

Die Claim-Werte werden aktuell als Mock-Daten auf Basis der PID-Claims generiert. Die Disclosures enthalten die jeweiligen typspezifischen Felder.

---

## 10. CORS-Konfiguration

```
Allowed Origins: process.env.ALLOWED_ORIGINS (kommagetrennt)
Allowed Methods: GET, POST, OPTIONS
Allowed Headers: Content-Type, Authorization
```

Beispiel: `ALLOWED_ORIGINS=http://localhost:3000,https://meine-app.vercel.app`

---

## 11. Umgebungsvariablen

| Variable | Required | Beschreibung | Beispiel |
|----------|----------|-------------|---------|
| `PRIVATE_KEY` | Ja | P-256 Private Key (PKCS#8 PEM, `\n` escaped) | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"` |
| `CERT_CHAIN` | Ja | Zertifikatskette PEM (Leaf + Intermediate CA, `\n` escaped) | `"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"` |
| `SERVICE_URL` | Ja | Öffentliche HTTPS-URL des Services | `https://fe-poc-production.up.railway.app` |
| `FRONTEND_URL` | Nein | Frontend-URL (Default: `http://localhost:3000`) | `https://meine-app.vercel.app` |
| `ALLOWED_ORIGINS` | Nein | CORS-Whitelist, kommagetrennt (Default: `http://localhost:3000`) | `http://localhost:3000,https://app.example.com` |
| `TRUST_LIST_URL` | Nein | Trust List Base-URL (Default: BMI OpenCode URL) | `https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists` |
| `PORT` | Nein | Server-Port (Default: `3001`, Railway setzt `8080`) | `8080` |

**Hinweis:** `CLIENT_ID` wird nicht als Variable benötigt – er wird automatisch aus `CERT_CHAIN` berechnet.

---

## 12. Datentypen

### PidClaims

```
{
  given_name: string          // Pflicht, nicht leer
  family_name: string         // Pflicht, nicht leer
  birthdate: string           // Pflicht, Format YYYY-MM-DD
  street_address?: string     // Optional
  postal_code?: string        // Optional
  locality?: string           // Optional
  country?: string            // Optional
}
```

### InitiateResponse

```
{
  sessionId: string           // UUID v4
  walletUrl: string           // openid4vp:// Deep Link URI
}
```

### ResultResponse

```
{
  status: 'pending' | 'complete' | 'error'
  pidClaims?: PidClaims       // Nur bei status = 'complete'
  errorMessage?: string       // Nur bei status = 'error'
}
```

### DcqlQuery (für JAR)

```
{
  credentials: [{
    id: string                       // z.B. "pid-sd-jwt"
    format: 'dc+sd-jwt' | 'mso_mdoc'
    meta?: {
      vct_values?: string[]          // z.B. ["urn:eudi:pid:de:1"]
      doctype_value?: string
    }
    claims: [{
      path: (string | number)[]      // z.B. ["given_name"], ["address"]
    }]
  }]
  credential_sets?: [{
    options: string[][]              // z.B. [["pid-sd-jwt"]]
    required?: boolean
  }]
}
```

### CredentialType

```
type CredentialType = 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'
```

### IssuanceSessionState

```
{
  credentialType: CredentialType         // Typ des auszustellenden Credentials
  preAuthorizedCode: string              // 32 Bytes, base64url
  accessToken?: string                   // gesetzt nach Token Exchange
  cNonce?: string                        // gesetzt nach Token Exchange
  cNonceExpiresAt?: number               // cNonce Ablaufzeit (Unix ms)
  pidClaims?: PidClaims                  // gesetzt nach PID-Verifikation
  holderPublicKeyJwk?: JWK              // gesetzt nach Credential-Ausstellung
  createdAt: number                      // Unix-Timestamp (ms)
  expiresAt: number                      // createdAt + 15 Minuten
  status: 'pending_pid' | 'pid_verified' | 'offer_created' | 'issued' | 'error'
  errorMessage?: string
}
```

### CredentialOfferObject

```
{
  credential_issuer: string              // z.B. "https://service.railway.app"
  credential_configuration_ids: string[] // z.B. ["wohnungsgeberbestaetigung"]
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': string      // base64url(32 random bytes)
    }
  }
}
```

### IssuanceInitiateRequest

```
{
  credentialType: CredentialType         // Pflicht
  returnUrl?: string                     // Optional, für Same-Device Flow
}
```

### IssuanceInitiateResponse

```
{
  sessionId: string                      // Issuance-Session-ID (UUID v4)
  vpSessionId: string                    // VP-Session-ID für PID-Abfrage (UUID v4)
  walletUrl: string                      // openid4vp:// Deep Link URI
}
```

### IssuanceResultResponse

```
{
  status: 'pending_pid' | 'pid_verified' | 'offer_created' | 'issued' | 'error'
  pidClaims?: PidClaims                  // Nur bei status = 'pid_verified'
  errorMessage?: string                  // Nur bei status = 'error'
}
```

---

## 13. Dependencies

| Package | Version | Zweck |
|---------|---------|-------|
| `hono` | ^4.7.4 | HTTP Framework (leichtgewichtig, Web-Standard-kompatibel) |
| `@hono/node-server` | ^1.13.8 | Node.js Adapter für Hono |
| `jose` | ^6.0.10 | JWT/JWE/JWK Operationen (Sign, Verify, Encrypt, Decrypt) |
| `@sd-jwt/core` | ^0.14.0 | SD-JWT Handling und SD-JWT-VC Credential Erstellung |
| `tsx` | ^4.19.3 | TypeScript-Ausführung (Runtime) |

**Runtime:** Node.js >= 20 (für `crypto.subtle`, native `fetch`, ES modules)

---

## 14. Bekannte Wallet-Eigenheiten (Kompatibilität)

Diese Punkte sind framework-unabhängig und müssen bei jeder Neuimplementierung beachtet werden:

1. **`vp_formats_supported`** statt `vp_formats` – die Wallet (SPRIND/eudiw-app) liest diesen Feldnamen
2. **`encrypted_response_enc_values_supported`** – die Felder `authorization_encrypted_response_alg` und `authorization_encrypted_response_enc` werden von der Wallet NICHT gelesen
3. **Ephemeral JWK braucht `kid` und `alg`** – Wallet filtert Keys ohne diese Felder heraus → `invalidClientMetadata`
4. **`birthdate`** (nicht `birth_date`) – SPRIND Sandbox PID verwendet OIDC Core Namenskonvention
5. **`address`** als Top-Level DCQL Claim anfordern – nicht die Unterfelder einzeln
6. **Zertifikatskette muss Intermediate CA enthalten** – nur Leaf → `invalidClientMetadata`
7. **`response_mode: "direct_post.jwt"`** – Wallet verschlüsselt die Antwort als JWE
8. **`aud: "https://self-issued.me/v2"`** – Standard Self-Issued OP Audience
9. **client_id muss x509_hash Schema verwenden** – HAIP-konform für SPRIND Wallet
10. **VP Token im DCQL-Format:** `vp_token` kann ein Object sein (`{ "pid-sd-jwt": ["eyJ..."] }`) statt ein einfacher String

---

## 15. Sequenz-Diagramme (Mermaid)

### 15.1 Haupt-Flow (Cross-Device / QR-Code)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend<br/>(Next.js)
    participant SVC as EUDI Wallet<br/>Service
    participant TL as Trust List<br/>(BMI OpenCode)
    participant W as EUDI Wallet<br/>App (Handy)

    note over SVC,TL: Server-Start
    SVC->>TL: GET /pid-provider.jwt
    SVC->>TL: GET /wallet-provider.jwt
    TL-->>SVC: Signierte Trust Lists (JAdES JWT)
    note over SVC: Trust Lists cachen (24h TTL)

    note over FE,W: Session initiieren
    FE->>SVC: POST /initiate
    note over SVC: sessionId = UUID v4<br/>nonce = random(32 bytes, base64url)<br/>ephKeyPair = ECDH-ES P-256<br/>JAR = SignJWT(ES256, x5c, payload)<br/>Session speichern (TTL 10 min)
    SVC-->>FE: 200 { sessionId, walletUrl }

    note over FE: QR-Code mit walletUrl anzeigen<br/>Polling starten (GET /result alle 2s)

    note over FE,W: Wallet-Präsentation
    W->>SVC: GET /request/{sessionId}
    note over SVC: Session prüfen<br/>(existiert? abgelaufen?)
    SVC-->>W: 200 JAR (application/oauth-authz-req+jwt)

    note over W: JAR validieren<br/>x5c Zertifikatskette prüfen<br/>DCQL Query lesen<br/>User um Freigabe bitten

    W->>W: User gibt PID-Daten frei

    W->>SVC: POST /callback/{sessionId}<br/>Content-Type: x-www-form-urlencoded<br/>response=<JWE (ECDH-ES + A256GCM)>

    note over SVC: 7-Schichten-Validierung<br/>(siehe Diagramm 15.3)
    note over SVC: Session → status: complete<br/>PID Claims speichern

    SVC-->>W: 200 { redirect_uri: /done/{sessionId} }

    W->>SVC: GET /done/{sessionId}
    SVC-->>W: HTML Erfolgsseite<br/>("Daten übertragen. Fenster schließen.")

    note over FE: Polling erkennt Abschluss
    FE->>SVC: GET /result/{sessionId}
    SVC-->>FE: 200 { status: "complete", pidClaims: {...} }
    note over SVC: Session löschen

    note over FE: Formularfelder befüllen<br/>"Aus Wallet" Badges anzeigen
```

### 15.2 Same-Device Flow (Mobile Deep Link)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend<br/>(Mobile Browser)
    participant SVC as EUDI Wallet<br/>Service
    participant W as EUDI Wallet<br/>App (selbes Gerät)

    FE->>SVC: POST /initiate<br/>{ returnUrl: "http://192.168.1.100:3000" }
    note over SVC: Session + returnUrl speichern<br/>(returnUrl in separater Map, TTL 15 min)
    SVC-->>FE: 200 { sessionId, walletUrl }

    note over FE: window.location.href = walletUrl<br/>(öffnet Wallet direkt, kein QR)<br/>Polling starten (GET /result alle 2s)

    FE->>W: openid4vp://...?client_id=...&request_uri=...

    W->>SVC: GET /request/{sessionId}
    SVC-->>W: 200 JAR JWT

    note over W: User gibt PID-Daten frei

    W->>SVC: POST /callback/{sessionId}<br/>response=[JWE]
    note over SVC: Validierung + PID extrahieren<br/>Session → complete
    SVC-->>W: 200 { redirect_uri: /done/{sessionId} }

    W->>SVC: GET /done/{sessionId}
    note over SVC: returnUrl vorhanden?<br/>→ Same-Device erkannt
    SVC-->>W: HTML mit window.close() im head-Tag
    note over W: Tab schließt sich sofort

    note over FE: Bewerbungs-Tab kommt<br/>in den Vordergrund

    FE->>SVC: GET /result/{sessionId}
    SVC-->>FE: 200 { status: "complete", pidClaims: {...} }
    note over SVC: Session löschen<br/>(returnUrl lebt weiter bis 15 min TTL)

    note over FE: Formularfelder befüllen
```

### 15.3 VP Token Validierung (7 Schichten)

```mermaid
flowchart TD
    START(["POST /callback empfangen"]) --> L1

    subgraph L1["Layer 1: Transport & Struktur"]
        L1A{"response Feld<br/>vorhanden?"}
        L1A -->|"Ja: direct_post.jwt"| L1B["JWE mit ephemeral<br/>Private Key entschlüsseln"]
        L1B --> L1C{"Format des<br/>entschlüsselten Inhalts?"}
        L1C -->|"JSON mit vp_token string"| L1D["vp_token extrahieren"]
        L1C -->|"JSON mit vp_token object (DCQL)"| L1E["Erstes Credential aus<br/>Object extrahieren"]
        L1C -->|"JARM JWT"| L1F["JWT dekodieren,<br/>vp_token aus Payload"]
        L1C -->|"Raw SD-JWT"| L1G["Direkt als vp_token<br/>verwenden"]
        L1A -->|"Nein: direct_post"| L1H["vp_token direkt<br/>aus Body"]
    end

    L1D --> L2
    L1E --> L2
    L1F --> L2
    L1G --> L2
    L1H --> L2

    subgraph L2["Layer 2: Session Binding"]
        L2A["nonce matches session.nonce?"]
        L2A --> L2B["aud matches client_id<br/>oder SERVICE_URL?"]
        L2B --> L2C["iat nicht in Zukunft?<br/>exp nicht abgelaufen?"]
    end

    L2 --> L3

    subgraph L3["Layer 3: Credential Assurance"]
        L3A["Issuer JWT aus SD-JWT<br/>extrahieren"]
        L3A --> L3B["Credential exp prüfen"]
        L3B --> L3C["x5c Issuer-Zertifikat<br/>gegen Trust List prüfen"]
    end

    L3 --> L4

    subgraph L4["Layer 4: Holder Binding"]
        L4A["KB-JWT extrahieren<br/>(letzter Teil des SD-JWT)"]
        L4A --> L4B["typ ist kb+jwt?"]
        L4B --> L4C["nonce in KB-JWT<br/>matches session.nonce?"]
    end

    L4 --> L5

    subgraph L5["Layer 5: Wallet Integrity"]
        L5A{"wallet_attestation<br/>oder wal Feld<br/>vorhanden?"}
        L5A -->|"Ja"| L5B["Gegen wallet-provider<br/>Trust List prüfen"]
        L5A -->|"Nein"| L5C["Sandbox: Warning loggen<br/>und fortfahren"]
    end

    L5 --> L6

    subgraph L6["Layer 6: Selective Disclosure"]
        L6A["SD-JWT splitten"]
        L6A --> L6B["Mind. 2 Teile?<br/>(JWT + Disclosures)"]
        L6B --> L6C["Mind. 1 Disclosure<br/>vorhanden?"]
    end

    L6 --> EXTRACT["PID Claims extrahieren<br/>Disclosures dekodieren<br/>Address-Felder auflösen"]
    EXTRACT --> L7

    subgraph L7["Layer 7: Business Rules"]
        L7A["given_name nicht leer?"]
        L7A --> L7B["family_name nicht leer?"]
        L7B --> L7C["birthdate nicht leer?"]
        L7C --> L7D["birthdate Format<br/>YYYY-MM-DD?"]
    end

    L7 --> SUCCESS(["Session complete,<br/>PID Claims zurückgeben"])

    style L1 fill:#e8f4f8,stroke:#0288d1
    style L2 fill:#e8f5e9,stroke:#388e3c
    style L3 fill:#fff3e0,stroke:#f57c00
    style L4 fill:#fce4ec,stroke:#c62828
    style L5 fill:#f3e5f5,stroke:#7b1fa2
    style L6 fill:#e0f2f1,stroke:#00695c
    style L7 fill:#fff8e1,stroke:#f9a825
    style SUCCESS fill:#c8e6c9,stroke:#2e7d32
```

### 15.4 Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending : POST /initiate, TTL 10 min

    pending --> complete : Validierung OK
    pending --> error : Validierung fehlgeschlagen
    pending --> expired : TTL abgelaufen

    complete --> [*] : Claims abgerufen, Session geloescht
    error --> [*] : Error abgerufen, Session geloescht
    expired --> [*] : Automatisch geloescht

    note right of pending
        Frontend pollt GET /result alle 2s
        Antwort 202 status pending
    end note

    note right of complete
        GET /result liefert 200 mit pidClaims
        Einmalig abrufbar
    end note
```

### 15.5 Kryptographische Operationen im Überblick

```mermaid
flowchart LR
    subgraph Initiate["POST /initiate"]
        I1["ECDH-ES P-256<br/>Ephemeral Keypair"] --> I2["Export Public Key<br/>als JWK"]
        I3["random(32 bytes)"] --> I4["Nonce<br/>(base64url)"]
    end

    subgraph JAR["JAR Erstellen"]
        J1["PEM → DER<br/>Leaf Certificate"] --> J2["SHA-256<br/>Thumbprint"]
        J2 --> J3["client_id =<br/>x509_hash:base64url(hash)"]
        J4["PKCS#8 PEM<br/>Private Key"] --> J5["ES256 Signatur"]
        J6["PEM Cert Chain<br/>→ base64 DER Array"] --> J7["x5c Header"]
        J5 --> J8["Signierter JWT"]
        J7 --> J8
    end

    subgraph Callback["POST /callback"]
        C1["JWE<br/>(ECDH-ES + A256GCM)"] --> C2["Entschlüsseln mit<br/>Ephemeral Private Key"]
        C2 --> C3["vp_token<br/>(SD-JWT)"]
        C3 --> C4["Disclosures<br/>base64url dekodieren"]
        C4 --> C5["PID Claims"]
    end

    Initiate --> JAR
    JAR --> Callback

    style Initiate fill:#e3f2fd,stroke:#1565c0
    style JAR fill:#fff3e0,stroke:#ef6c00
    style Callback fill:#e8f5e9,stroke:#2e7d32
```

---

## 16. EUDI Sandbox Setup (Access Certificate)

Falls das Access Certificate neu erstellt werden muss:

1. P-256 Keypair generieren (ES256)
2. Public Key (SPKI PEM) in EUDI Sandbox hochladen → Access Certificate erstellen
3. Leaf Certificate + Intermediate CA (PEM) → als `CERT_CHAIN` konfigurieren
4. Private Key (PKCS#8 PEM) → als `PRIVATE_KEY` konfigurieren
5. `CLIENT_ID` wird automatisch berechnet

**Intermediate CA:**
```
GET https://sandbox.eudi-wallet.org/api/ca
```
Response: PEM-Zertifikat der German Registrar Intermediate CA. An Leaf-Zertifikat anhängen.

**Trust List URL:** `https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/`

**Sandbox Registration Certificate Felder:**
- Credential: `dc+sd-jwt` → `given_name`, `family_name`, `birthdate`, `address` (mit Unterfelder `postal_code`)
- VCT: `urn:eudi:pid:de:1`
- Privacy Policy: echte URL (nicht example.com)

---

## 17. Checkliste für die Migration

- [ ] HTTP-Server mit 6 Routen: `/health`, `/initiate`, `/request/:id`, `/callback/:id`, `/done/:id`, `/result/:id`
- [ ] CORS Middleware mit konfigurierbarer Origin-Whitelist
- [ ] ES256 JWT Signierung (JAR) mit x5c Header (PEM-Zertifikatskette)
- [ ] ECDH-ES P-256 Ephemeral Keypair Generierung (pro Session)
- [ ] JWE Entschlüsselung (compact format, ECDH-ES + A128GCM/A256GCM)
- [ ] SD-JWT Parsing (Split by `~`, Disclosure Dekodierung, Claim Merge)
- [ ] KB-JWT Validierung (typ: `kb+jwt`, Nonce-Check)
- [ ] x509_hash Client-ID Berechnung aus Leaf-Zertifikat
- [ ] Session Store mit TTL und automatischer Bereinigung
- [ ] Separate returnUrl Map mit eigenem TTL (15 min)
- [ ] Trust List Laden und Cachen (JWT-Format, 24h TTL)
- [ ] Form-urlencoded Body Parsing (Wallet sendet `response` als JWE)
- [ ] DCQL VP Token Format Handling (Object statt String)
- [ ] Same-Device / Cross-Device Erkennung via returnUrl
- [ ] HTML-Seite mit `window.close()` für Same-Device Flow
- [ ] Statische Erfolgsseite für Cross-Device Flow

**OpenID4VCI Credential Issuance:**

- [ ] OpenID4VCI Issuer Metadata Endpoints (`/.well-known/openid-credential-issuer`, `/.well-known/oauth-authorization-server`)
- [ ] Pre-Authorized Code Flow: initiate → offer → token → credential
- [ ] Issuance Session Store mit TTL (15 min) und Pre-Auth-Code/Access-Token Lookups
- [ ] SD-JWT-VC Credential Builder (ES256 Signatur, x5c Header, Selective Disclosure)
- [ ] Token Endpoint (Pre-Authorized Code → access_token + c_nonce)
- [ ] Credential Endpoint (Proof-of-Possession Validierung, SD-JWT-VC Erstellung)
- [ ] Credential Offer URI Generation (`openid-credential-offer://`)
- [ ] VP-Session → Issuance-Session Auto-Linking im Callback
- [ ] Nonce Endpoint für frische c_nonce Werte
- [ ] Issuance Result Polling Endpoint
