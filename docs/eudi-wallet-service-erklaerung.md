# EUDI Wallet Service – Technische Erklärung

> Detaillierte Beschreibung was der Service macht, wie die Kommunikation abläuft und was die 7 Validierungsschichten prüfen.

---

## Was der Service tut – Gesamtbild

Der Service ist der **Vermittler zwischen dem EUDI Wallet (auf dem Handy) und dem Frontend (im Browser)**. Er ist nötig, weil das Wallet eine kryptografisch signierte, öffentlich erreichbare HTTPS-URL braucht – das kann kein lokales Next.js-Frontend liefern.

Der Service übernimmt zwei Rollen:

- **Relying Party (OpenID4VP)** – liest den PID (Person Identification Data) aus der Wallet aus und validiert ihn über 7 Sicherheitsschichten
- **Credential Issuer (OpenID4VCI)** – stellt neue Credentials (z.B. Wohnungsgeberbestätigung, Genossenschafts-Mitgliedsbescheinigung) aus und schreibt sie in die Wallet zurück

---

## Die 5 Schritte im Ablauf

### 1. `POST /initiate` – Session starten

Das Frontend ruft diesen Endpunkt auf, wenn der User auf "Mit Wallet ausfüllen" klickt. Der Service:

- Generiert eine **Session-ID** (UUID) und eine **Nonce** (32 zufällige Bytes, base64url) – die Nonce ist der Kern der Sicherheit, weil sie später zum Prüfen der Wallet-Antwort verwendet wird
- Generiert ein **ephemeres P-256-Schlüsselpaar** – der öffentliche Schlüssel geht später an die Wallet, damit diese ihre Antwort verschlüsseln kann; der private Schlüssel bleibt im RAM des Services zum Entschlüsseln
- Speichert all das in der In-Memory Session Map (10 Minuten gültig)
- Gibt dem Frontend zurück: `{ sessionId, walletUrl }` – die `walletUrl` ist eine `openid4vp://`-URL, die entweder als QR-Code dargestellt oder als Deep Link geöffnet wird

---

### 2. `GET /request/:sessionId` – Den JAR liefern

Die **Wallet-App** (nicht das Frontend!) ruft diese URL ab, nachdem sie den QR-Code gescannt oder den Deep Link geöffnet hat. Der Service liefert einen **JAR (JWT Authorization Request)** – ein signiertes JWT mit:

- `dcql_query`: Die Anfrage, welche Felder er aus dem PID haben möchte (`given_name`, `family_name`, `birthdate`, `address.street_address`, `address.postal_code`, `address.locality`) – nur `dc+sd-jwt` Format, kein mdoc (weil mdoc auf iOS iOS-seitige CA-Verifikation bräuchte)
- `nonce`: Muss später in der Antwort zurückkommen
- `response_uri`: Wohin die Wallet die Antwort schicken soll → `/callback/:id`
- `client_metadata.jwks`: Der ephemere **Public Key** (den der Service in Schritt 1 generiert hat) – die Wallet nutzt ihn, um die Antwort zu verschlüsseln
- `client_id`: Ein `x509_hash:`-Identifier, der kryptografisch aus dem Leaf-Zertifikat des Access Certificates berechnet wird (`SHA-256(leafCert_DER)` als base64url)

Der JAR ist mit dem **privaten Schlüssel des Access Certificates** signiert (`ES256`, `x5c`-Header mit der Zertifikatskette). Damit weist sich der Service gegenüber der Wallet als vertrauenswürdiger Verifier aus.

---

### 3. `POST /callback/:sessionId` – Die Wallet-Antwort empfangen

Nach Nutzer-Freigabe in der Wallet schickt sie einen **VP Token** an diesen Endpunkt. Das Format ist `application/x-www-form-urlencoded` mit einem `response`-Feld – einem **JWE** (verschlüsseltes JWT, `direct_post.jwt` mode).

Hier läuft die 7-Schichten-Validierung (→ siehe unten).

Bei Erfolg: Session auf `complete` + PID-Claims gespeichert, Antwort an Wallet: `{ redirect_uri: "https://service-url/done/:id" }`.

---

### 4. `GET /done/:sessionId` – Wallet-Browser-Landingpage

Die Wallet öffnet diese URL im Browser. Zwei Varianten:
- **Same-Device:** `window.close()` → Tab schließt sich sofort → Bewerbungs-Tab kommt in den Vordergrund
- **Cross-Device:** Statische grüne Erfolgsseite ("Ihre Daten wurden erfolgreich übertragen.")

---

### 5. `GET /result/:sessionId` – Frontend pollt

Das Frontend fragt alle 2 Sekunden nach. Antwort:
- `202` – noch ausstehend
- `200` + PID-Claims – fertig, Session wird danach gelöscht
- `400` – Validierungsfehler

---

## Die 7 Validierungsschichten

Alle 7 laufen sequenziell in `validator.ts`, **fail-fast** – bei der ersten Verletzung wird sofort abgebrochen.

### Layer 1 – Transport & Struktur

Der `response`-Body kommt als JWE. Der Service **entschlüsselt** ihn mit dem ephemeren Private Key (der in Schritt 1 generiert wurde – nur dieser Service kann entschlüsseln). Danach muss er herausfinden, was drin ist – das Wallet kann verschiedene Formate verwenden:

- **JARM JWT** (signiertes Authorization Response JWT) → `vp_token` darin
- **JSON** mit `vp_token`-Feld (String oder DCQL-Objekt `{ "pid-sd-jwt": ["eyJ...~..."] }`)
- **JSON Serialized JWS** mit `payload`-Feld
- **Direkt ein SD-JWT** (enthält `~`)

Am Ende kommt immer ein roher SD-JWT-String raus. Zusätzlich: Größenprüfung (max 2 MB).

### Layer 2 – Session Binding

Schützt gegen **Replay-Angriffe**:

- `nonce` in der Antwort muss exakt mit `session.nonce` übereinstimmen (die in Schritt 1 generiert wurde) – so kann niemand eine alte Antwort wiederverwenden
- `aud` (Audience) muss unsere `client_id` oder `SERVICE_URL` sein – verhindert, dass eine Antwort an einen anderen Verifier gesendet und dann hier eingespielt wird
- `iat` (Issued At) darf nicht in der Zukunft liegen, `exp` darf nicht abgelaufen sein

### Layer 3 – Credential Assurance

Prüft, ob das **PID-Credential vom Aussteller vertrauenswürdig** ist:

- Ist das Credential abgelaufen? (`exp`-Claim)
- Hat der Issuer ein `x5c`-Zertifikat im Header? (Zertifikatsketten-Validierung)
- Ist der Issuer in der **Trust List** (geladen von `bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/pid-provider.jwt`)?

Im POC wird bei leerer Trust List gewarnt aber nicht blockiert (Sandbox-Modus).

### Layer 4 – Holder Binding (Key Binding JWT)

Ein SD-JWT endet mit einem **KB-JWT (Key Binding JWT)** – das ist der Nachweis, dass der Wallet-Inhaber tatsächlich derjenige ist, an den das Credential gebunden ist (Proof-of-Possession):

- Letzter Teil nach `~` muss vorhanden und nicht leer sein
- `typ`-Header muss `kb+jwt` sein
- `nonce` im KB-JWT muss mit unserer Session-Nonce übereinstimmen – verhindert, dass jemand ein gültiges Credential eines anderen Nutzers präsentiert ("Credential Sharing Attack")

### Layer 5 – Wallet Integrity

Prüft, ob die **Wallet-App selbst vertrauenswürdig** ist (nicht kompromittiert):

- Sucht nach `wallet_attestation` oder `wal` im VP Token
- Falls vorhanden: Signatur gegen **Wallet Provider Trust List** (`wallet-provider.jwt`) prüfen
- Im POC: Falls kein Attestation-Claim vorhanden → Warnung, kein Fehler (Sandbox-Toleranz)

### Layer 6 – Selective Disclosure

Prüft, ob der SD-JWT **überhaupt Disclosures** enthält:

- SD-JWT Format: `<issuer-jwt>~<disclosure1>~<disclosure2>~...~<kb-jwt>`
- Alle `~`-getrennten Teile (außer erstem und letztem) sind Disclosures
- Mindestens eine Disclosure muss vorhanden sein – sonst wurden keine Felder freigegeben

### Layer 7 – Business Rules

Letzte Prüfung: Sind die **extrahierten Daten tatsächlich verwendbar**?

- `given_name` darf nicht leer sein
- `family_name` darf nicht leer sein
- `birthdate` darf nicht leer sein und muss das Format `YYYY-MM-DD` haben (RegEx: `/^\d{4}-\d{2}-\d{2}$/`)

---

## OpenID4VCI – Credential in die Wallet ausstellen

Neben der Verifikation (OpenID4VP) kann der Service auch neue Credentials ausstellen und in die Wallet schreiben (OpenID4VCI). Der Ablauf kombiniert zuerst eine PID-Verifizierung (um die Identität des Nutzers zu bestätigen) und danach eine Credential-Ausstellung.

### Die 8 Schritte im Issuance-Ablauf

#### 1. `POST /issuer/initiate` – Session starten

Frontend ruft auf mit `credentialType` und optional `returnUrl`. Der Service:

- Erstellt eine VP-Session für PID-Verifizierung (gleicher OpenID4VP-Flow) UND eine Issuance-Session
- VP-Session speichert `issuanceSessionId` für Auto-Linking
- Issuance-Session speichert Pre-Authorized Code (32 zufällige Bytes, base64url)
- Gibt zurück: `{ sessionId (issuance), vpSessionId, walletUrl (openid4vp://) }`

---

#### 2. PID-Verifizierung (bestehender OpenID4VP-Flow)

- Wallet scannt QR / öffnet Deep Link → `GET /request/:vpId` → `POST /callback/:vpId`
- Callback erkennt `issuanceSessionId` auf der VP-Session und überträgt PID-Claims automatisch in die Issuance-Session
- Frontend pollt `GET /issuer/result/:issuanceSessionId` statt `/result/:vpId`

---

#### 3. `GET /issuer/result/:sessionId` – Status abfragen

| Status | HTTP | Bedeutung |
|--------|------|-----------|
| `pending_pid` | 202 | PID noch nicht verifiziert |
| `pid_verified` | 200 | PID verifiziert, `pidClaims` in Response |
| `offer_created` | 202 | Offer erstellt, wartet auf Wallet |
| `issued` | 200 | Credential ausgestellt |
| `error` | 400 | Fehler |

---

#### 4. `POST /issuer/create-offer/:sessionId` – Credential Offer erstellen

- Frontend ruft auf nachdem User "Weiter zur Ausstellung" klickt
- Erstellt `openid-credential-offer://` URI mit `credential_offer_uri`
- Gibt `walletUrl` zurück für QR-Code / Deep Link

---

#### 5. `GET /issuer/offer/:sessionId` – Credential Offer abrufen

- Wallet ruft diese URL ab (aus dem `credential_offer_uri` Parameter)
- Enthält: `credential_issuer`, `credential_configuration_ids`, Pre-Authorized Code

---

#### 6. `POST /issuer/token` – Token Exchange

- Wallet tauscht Pre-Authorized Code gegen `access_token` + `c_nonce`
- Unterstützt form-urlencoded und JSON
- `c_nonce` wird für Proof-of-Possession benötigt (5 Min TTL)

---

#### 7. `POST /issuer/credential` – Credential abrufen

- Wallet sendet `Authorization: Bearer <access_token>` + Proof-of-Possession JWT
- Service validiert Proof (extrahiert Holder Public Key aus `jwk` Header)
- Erstellt SD-JWT-VC mit `@sd-jwt/core` und Access Certificate Signatur
- Alle Claim-Felder sind selectively disclosable
- Gibt `{ credential, format: "vc+sd-jwt" }` zurück

---

#### 8. Well-Known Metadata

- `GET /.well-known/openid-credential-issuer` → Credential-Konfigurationen, Endpoint-URLs, Display-Namen
- `GET /.well-known/oauth-authorization-server` → Token Endpoint, unterstützte Grant-Typen

---

## Credential Builder (`credential-builder.ts`)

Der Credential Builder erstellt SD-JWT-VCs und bridgt die verschiedenen Krypto-Interfaces:

- Bridgt `jose` CryptoKey (Access Certificate Private Key) zu `@sd-jwt/core` Signer Interface
- `crypto.subtle.sign(ECDSA, SHA-256)` → base64url Signatur
- SHA-256 Hasher für SD-JWT Disclosure Hashing
- Salt Generator: `randomBytes(16).toString('base64url')`
- Header: `{ typ: 'vc+sd-jwt', x5c: certChain }` — gleiche Zertifikatskette wie bei JAR-Signierung
- Alle Claim-Felder in `_sd` DisclosureFrame → selectively disclosable

### Zwei Credential-Typen

**Wohnungsgeberbestätigung** (`urn:credential:wohnungsgeberbestaetigung:1`):

- Aus PID (verifiziert): `given_name`, `family_name`, `birthdate`
- Mock-Daten: `street_address`, `postal_code`, `locality`, `move_in_date`, `landlord_name`
- Holder Binding: `cnf.jwk` mit Public Key der Wallet

**Genossenschafts-Mitgliedsbescheinigung** (`urn:credential:genossenschaft-mitglied:1`):

- Aus PID (verifiziert): `given_name`, `family_name`, `birthdate`
- Mock-Daten: `cooperative_name`, `membership_number`, `member_since`

---

## Wie PID-Claims extrahiert werden (`pid.ts`)

Ein SD-JWT hat die Struktur `issuer-jwt~disclosure1~disclosure2~...~kb-jwt`. Jede **Disclosure** ist base64url-kodiertes JSON der Form `[salt, claimName, claimValue]`. Der Service:

1. Dekodiert alle Disclosures
2. Merged sie mit dem Issuer-JWT-Payload (Disclosures haben Vorrang)
3. Baut daraus ein `PidClaims`-Objekt

Der Grund für dieses Format: **Selective Disclosure** – der Nutzer hat in der Wallet ausgewählt, welche Claims er freigibt. Nur die freigegebenen Felder kommen als Disclosures an.

---

## Trust Lists (`trustlist.ts`)

Beim Service-Start werden zwei JWTs vom BMI-Server geladen:

- `pid-provider.jwt` → welche Aussteller (z.B. Bundesdruckerei) vertrauenswürdig sind
- `wallet-provider.jwt` → welche Wallet-Apps vertrauenswürdig sind

Gecacht für **24 Stunden**. Die Thumbprints (SHA-256-Fingerabdrücke der Zertifikate) werden für Layer 3 und Layer 5 verwendet.

```
TRUST_LIST_URL = https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/
```

---

## JAR (`jar.ts`)

Der JAR enthält die DCQL-Query, die festlegt was der Service vom Wallet anfordert:

```typescript
// Nur dc+sd-jwt (kein mso_mdoc) – vermeidet ISO 18013-5 Reader Auth,
// die die German Registrar Root CA im iOS System Trust Store erfordern würde
{
  credentials: [{
    id: 'pid-sd-jwt',
    format: 'dc+sd-jwt',
    meta: { vct_values: ['urn:eudi:pid:de:1'] },
    claims: [
      { path: ['given_name'] },
      { path: ['family_name'] },
      { path: ['birthdate'] },
      { path: ['address', 'street_address'] },
      { path: ['address', 'postal_code'] },
      { path: ['address', 'locality'] },
    ]
  }]
}
```

Die `client_id` wird automatisch aus dem Zertifikat berechnet:
```
client_id = "x509_hash:" + base64url(SHA-256(leafCert_DER))
```

---

## Sicherheitseigenschaften im Überblick

| Eigenschaft | Mechanismus |
|-------------|-------------|
| Verschlüsselung | JWE mit ephemerem P-256-Schlüssel – nur dieser Service kann entschlüsseln |
| Replay-Schutz | Einmalige Nonce pro Session – nach Nutzung ungültig |
| Aussteller-Vertrauen | Trust List der Bundesdruckerei (Layer 3) |
| Inhaber-Bindung | KB-JWT mit Nonce-Prüfung (Layer 4) |
| Wallet-Vertrauen | Wallet Attestation gegen Trust List (Layer 5) |
| Service-Identität | Access Certificate mit x5c im JAR |
| Session-Sicherheit | 10-Minuten TTL, automatische Bereinigung |
| Pre-Authorized Code | Einmalig, 32 Bytes kryptographisch zufällig |
| Access Token | Session-gebunden, Bearer Token, 10 Min Gültig |
| Proof-of-Possession | Wallet beweist Key-Besitz via JWT mit `c_nonce` |
| Credential Signatur | SD-JWT-VC signiert mit Access Certificate (ES256, x5c) |
| Selective Disclosure | Alle Felder in `_sd` → Wallet entscheidet was sie preisgibt |
