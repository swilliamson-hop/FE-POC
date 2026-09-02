# Persistente Personen-ID (`personal_administrative_number`) – Untersuchung & Sandbox-Test

> **Kontext:** Use Case 1 (PID-Übernahme & Anti-Fraud) verhindert gefälschte
> Identitätsdaten, aber nicht, dass dieselbe reale Person mehrfach Profile mit
> identischen Daten anlegt. Ziel: einen **persistenten, personen-eindeutigen
> Identifier** aus der PID mitanfragen, um Dubletten erkennen zu können.
> **Status: ABGESCHLOSSEN (2026-09-02).** `personal_administrative_number` wird
> von der preprod-PID nicht ausgestellt (belegt), und ein PID-basierter
> Dubletten-Check ist für Immomio rechtlich nicht zulässig (SPRIND/eIDAS: keine
> nationale Identifizierungspflicht). Anti-Fraud-Ziel „eine Person = max. ein
> Account" ist mit der Wallet **by design nicht** lösbar. Die additive
> DCQL-Anfrage bleibt drin (schadet nicht). Compliant erreichbar wäre nur
> Wallet-Login via selbst ausgestelltem Credential. Details siehe unten.

---

## 1. Welches Attribut? – `personal_administrative_number`, nicht `unique_id`

In der eIDAS2 PID-Spezifikation (SD-JWT VC, `vct: urn:eudi:pid:de:1`) heißt der
persistente, personen-eindeutige Identifier **`personal_administrative_number`**:

> „A value assigned to the natural person that is unique among all personal
> administrative numbers issued by the provider."
> — [German/EU PID Rulebook, Annex 3.01](https://eudi.dev/2.1.0/annexes/annex-3/annex-3.01-pid-rulebook/)

- `unique_id` war der Name in **älteren ARF-Drafts** und wurde umbenannt. Das
  aktuelle `urn:eudi:pid:de:1` kennt kein Attribut `unique_id`.
- Es ist **top-level** (nicht in `address` verschachtelt) → **nicht** vom
  bekannten Nested-Address-Disclosure-Bug betroffen.
- Es ist **optional** im Credential → der PID-Provider (Bundesdruckerei preprod)
  muss es beim Ausstellen tatsächlich befüllt haben. **Das ist die eigentliche
  offene Frage**, die der Sandbox-Test beantwortet.

Es ist **nicht** die Wallet-Instance-/Session-ID (die bewusst instabil ist),
sondern ein vom PID-Provider vergebener, personengebundener Wert.

---

## 2. Was wurde geändert (Phase 1 – additiv, keine Breaking Changes)

| Datei | Änderung |
|---|---|
| `eudi-wallet-service/src/types.ts` | `personal_administrative_number?: string` zu `PidClaims`; `claim_sets?: string[][]` zu `DcqlCredential` |
| `eudi-wallet-service/src/lib/jar.ts` | Claim `pid_personal_admin_number` (`path: ['personal_administrative_number']`) zur DCQL-Query; **`claim_sets`** (siehe unten) |
| `eudi-wallet-service/src/lib/pid.ts` | Extraktion des Attributs (top-level); `[PID-DIAG]`-Logzeile (nur Präsenz + Länge, **kein Klartext**) |
| `web/src/components/bewerbung/types.ts` | `personal_administrative_number?: string` zu Frontend-`PidClaims` |
| `web/src/components/bewerbung/EudiWalletButton.tsx` | Anzeige „Persistente Personen-ID" im Erfolgs-Kasten (Wert bzw. „nicht im PID enthalten") |

### Warum `claim_sets`?

Ohne `claim_sets` behandelt DCQL **alle** gelisteten Claims als match-erforderlich.
Enthält das preprod-PID die optionale `personal_administrative_number` **nicht**,
würde das Credential nicht mehr matchen → **der bestehende PID-Flow bräche**.

`claim_sets` macht die Anfrage präferenzgeordnet und damit additiv:

```
claim_sets: [
  [ …7 bestehende Felder…, 'pid_personal_admin_number' ],  // bevorzugt
  [ …7 bestehende Felder… ],                               // Fallback = bisheriges Verhalten
]
```

Hat das PID das Attribut → Option 1. Fehlt es → Wallet fällt auf Option 2 zurück
(exakt die bisher angefragte Menge). Der bestehende Flow bleibt unberührt.

> **Zu verifizieren im Test:** dass die IDGo-Wallet `claim_sets` korrekt
> unterstützt (EUDI-RI-basiert, DCQL-konform – sollte passen). Falls die Wallet
> daran erstickt, ist der Fallback ein flacher Claim ohne `claim_sets` –
> mit dem Restrisiko aus dem vorigen Absatz.

---

## 3. Sandbox-Test-Prozedur (mit IDGo-Wallet auszuführen)

Der Test erfordert eine reale Wallet-Interaktion und kann nicht rein
serverseitig durchgeführt werden.

1. Deployen (Railway-Auto-Deploy nach Push) bzw. lokal starten.
2. Bewerbungsflow starten – QR/Deeplink mit der **IDGo-Wallet** (aktuelle Version)
   scannen und die PID-Präsentation durchspielen.
   ```bash
   curl -X POST https://fe-poc-production.up.railway.app/initiate \
     -H "Content-Type: application/json" -d '{}'
   # → walletUrl mit IDGo öffnen, Consent bestätigen
   ```
3. **Ergebnis ablesen** – zwei Wege:
   - **Frontend (primär):** Nach erfolgreicher Freigabe zeigt der grüne
     „Daten übernommen"-Kasten eine Zeile **„Persistente Personen-ID:"** mit dem
     Wert – bzw. „nicht im PID enthalten", falls das preprod-PID das Attribut
     nicht liefert.
   - **Railway-Logs (Backend-Gegenprobe):**
     ```
     [PID-DIAG] personal_administrative_number: present (len=NN)
     [PID-DIAG] personal_administrative_number: ABSENT
     ```
4. Ergebnis unten unter „Ergebnis" eintragen.

### Worauf achten
- **`present` vs. `ABSENT`** – liefert das preprod-PID das Attribut überhaupt?
- **Stabilität/Eindeutigkeit** – Sandbox-Provider vergeben oft **denselben
  Testwert an alle** Tester. Dann wäre der Wert für echte Dubletten-Erkennung
  unbrauchbar (false positives über verschiedene Personen). Falls möglich mit
  **zwei verschiedenen Testidentitäten** prüfen, ob sich der Wert unterscheidet,
  und ob er über **mehrere Präsentationen derselben** Identität **konstant** bleibt.

---

## 4. Ergebnis (Test 2026-09-02, IDGo-Wallet gegen Bundesdruckerei preprod)

| Frage | Ergebnis |
|---|---|
| `personal_administrative_number` im VP-Token vorhanden? | **Nein** – `[PID-DIAG] personal_administrative_number: ABSENT` |
| Länge / Format | n/a (nicht geliefert) |
| Über mehrere Präsentationen derselben Identität stabil? | n/a (nicht geliefert) |
| Zwischen verschiedenen Testidentitäten unterschiedlich? | n/a (nicht geliefert) |
| `claim_sets` von IDGo akzeptiert (Flow unverändert ok)? | **Ja** – mit `claim_sets` läuft der Flow normal (Wallet wählt den Fallback-Satz) |

### Beweisführung (zwei Schritte)

1. **Mit `claim_sets` (additiv):** Flow erfolgreich, aber
   `[PID-DIAG] … ABSENT`. Die Wallet wählte den Fallback-Satz ohne
   `personal_administrative_number` → sie konnte den bevorzugten Satz
   *mit* dem Attribut nicht erfüllen.
2. **Ohne `claim_sets` (Attribut als Pflicht-Claim, Diagnose-Experiment
   `9334646`):** Bereits **das Scannen des QR-Codes** schlug fehl – die
   Wallet fand **kein passendes Credential**. Das bestätigt eindeutig:
   das preprod-PID **enthält `personal_administrative_number` nicht**.
   Experiment danach revertiert (zurück auf die sichere `claim_sets`-Variante).

## 5. Fazit – BLOCKER (sandboxseitig nicht nutzbar)

**`personal_administrative_number` wird von der Bundesdruckerei-preprod-PID
derzeit nicht ausgestellt.** Das Attribut ist im PID-Rulebook **optional**,
und dieser Provider befüllt es (Stand 2026-09-02) nicht. Damit ist der
Persistente-Personen-ID-basierte Dubletten-Check **sandboxseitig nicht
umsetzbar** – es gibt schlicht keinen Wert zum Hashen/Abgleichen.

Kein Fehler in unserer DCQL-Anfrage (Feldname + Pfad sind korrekt, Wallet
interpretiert sie richtig) und kein Disclosure-Bug (das Attribut ist
top-level, nicht vom Nested-Address-Thema betroffen) – das Credential
enthält den Wert einfach nicht.

### Was bleibt bestehen (additiv, ohne Wirkung bis Provider liefert)
- DCQL fragt `personal_administrative_number` weiter via `claim_sets` an –
  **schadet nicht**, greift automatisch sobald ein Provider das Attribut liefert.
- Backend-Extraktion + `[PID-DIAG]`-Log bleiben als Monitoring.
- Frontend zeigt „nicht im PID enthalten".

### Offen / nächste Schritte (produktseitig zu entscheiden)
- **Phase 2 (Hashing + Dedup) ist blockiert**, bis ein PID-Provider
  `personal_administrative_number` tatsächlich ausstellt. Vorgesehenes Design
  bleibt gültig: HMAC-SHA256(`PID_ID_PEPPER`, Wert), In-Memory-Registry
  (Caveat: Reset bei Redeploy), Flag `duplicateOfPriorPresentation`, kein
  automatisches Blocken.
- Bei SPRIND/Bundesdruckerei nachfragen, ob/wann `personal_administrative_number`
  in der preprod-PID befüllt wird (analog zum Adress-Disclosure-Report).
- Alternativ prüfen, ob ein anderer persistenter Identifier (z. B. aus einer
  späteren Rulebook-Version) verfügbar wird.

---

## 6. SPRIND-Forum-Bestätigung (2026-09-02)

Auf Nachfrage im SPRIND-Forum hat **Mirko Mollik (SPRIND)** bestätigt, dass der
fehlende Identifier **kein Sandbox-Defekt, sondern eine bewusste Entscheidung**
ist:

> „Es gibt kein direktes Feld, welches als stabil angesehen werden kann, wie
> z. B. die Steuernummer."
>
> „Uns ist klar, dass es sicherlich Fälle in Deutschland geben wird, wo dieser
> Datensatz doppelt ist. Aber seitens Datenschutz wurde sich hier klar gegen
> eine eindeutige Nummer in der PID entschieden."
>
> Empfehlung für unseren Fall: Abfrage von **Vorname, Nachname, Geburtsort und
> Geburtstag**. Das **BMDS** werde dazu noch eine Empfehlung veröffentlichen.

**Wichtiger Vorbehalt (Mirko):**

> „Melde mich aber noch, da die Lösung eigentlich gegen die eIDAS verstößt."

→ Gemeint ist der **Stammdaten-Workaround** (Name + Geburtsort + Geburtstag als
Kombi-Schlüssel). Damit baut man faktisch doch einen persistenten, personen-
eindeutigen Identifier nach – genau das, was eIDAS2 (VO (EU) 2024/1183) durch das
Weglassen einer eindeutigen Nummer bewusst verhindern will. Kollidiert mit
**Unlinkability, Datenminimierung und Zweckbindung** (auch GDPR Art. 5). Exakte
Fundstelle liefert Mirko in seiner Rückmeldung nach; **DSB/Legal vor jeder
Umsetzung einbinden.**

**Konsequenz:** Sowohl die `personal_administrative_number` (nicht vorhanden) als
auch der Stammdaten-Hash-Fallback (rechtlich problematisch) scheiden aktuell aus.
Ein technischer Dubletten-Check über die PID ist damit **by design nicht
vorgesehen**.

## 7. Offene Alternative: Wallet-Login via RP-spezifischem Pseudonym

Der eIDAS2/ARF **Pseudonym-Use-Case** ist der *vorgesehene, datenschutzkonforme*
Weg, wiederkehrende Nutzer zu erkennen: Die Wallet präsentiert dem RP ein
**stabiles, RP-spezifisches Pseudonym** (schlüsselgebunden), das über andere
Dienste hinweg *nicht* verkettbar ist.

- **Löst:** „Wallet als Login" + Wiedererkennung desselben Wallet-Inhabers bei uns
  → verhindert versehentliche Doppel-Accounts mit **derselben** Wallet.
- **Löst NICHT vollständig:** Das Pseudonym ist an die **Wallet-Instanz/den
  Schlüssel** gebunden, **nicht an die Person**. Eine Person mit zwei
  Geräten/Wallets erzeugt zwei Pseudonyme → weiterhin zwei Accounts möglich
  (kein voller Sybil-Schutz – dieselbe bewusste Design-Grenze).
- **Warum konform (im Gegensatz zum Stammdaten-Hash):** Das Pseudonym ist gerade
  *nicht* personen-eindeutig/cross-context – deshalb erlaubt.

**Nächster Schritt:** Mirko im selben Thread nach dem Pseudonym-Use-Case fragen
(Unterstützung in der SPRIND-Wallet? Anfrage-Mechanismus in OpenID4VP/SIOPv2?).

## 8. SPRIND-Antwort zum Pseudonym (2026-09-02, 2. Runde)

Mirko Mollik (nach interner Rücksprache):

- **Pseudonyme sind nicht spezifiziert.** Wie Pseudonyme funktionieren, ist weder
  in den Implementing Acts noch bei ETSI geregelt — jedes Land/jede Wallet kann es
  anders umsetzen. Eine **native Pseudonym-Funktion** der Wallet wird es **zum
  Start nicht** geben; Zeitpunkt offen.
- **Empfohlener Weg: eigenes Credential ausstellen.** Statt auf eine Wallet-
  Pseudonym-Funktion zu warten, können **wir selbst der Wallet ein Credential (EAA)
  ausstellen**, das sie beim Login präsentiert. → Nutzt unseren bereits
  funktionierenden Issuance-Stack (POC 2). Ist **schlüsselgebunden** (Holder
  Binding an den Wallet-Key).
- **Kein Ein-Pseudonym-pro-RP-Zwang.** Es gibt **keinen Mechanismus**, der
  sicherstellt, dass eine Wallet nur EIN Pseudonym pro Relying Party hat.
- **PID-Weg ausdrücklich nicht empfohlen — mit Rechtsgrund:** Wir sollen dem Nutzer
  ein Pseudonym anbieten, weil wir **nicht unter eine nationale
  Identifizierungspflicht (z. B. GWG/Geldwäsche)** fallen. Nur Stellen mit
  gesetzlicher Identifizierungspflicht dürfen die PID zur eindeutigen
  Identifizierung heranziehen — Immomio nicht.

### Revidiertes Fazit

| Ziel | Mit EUDI-Wallet erreichbar? |
|---|---|
| **Wallet als Login / denselben Wallet-Inhaber wiedererkennen** | **Ja, konform** — via selbst ausgestelltem, schlüsselgebundenem Credential (auf POC-2-Basis) |
| **Verhindern, dass eine reale Person mehrere Accounts anlegt** | **Nein** — kein Ein-Pseudonym-pro-RP-Zwang; 1 Person + 2 Wallets = 2 Credentials; ein selbst ausgestelltes Credential kann den **ersten** Doppel-Account nicht blocken (Betrüger-Wallet hat es schlicht noch nicht) |

**Bottom line:** Der ursprüngliche Anti-Fraud-Zweck (Sybil-Schutz „eine Person =
max. ein Account") ist mit der Wallet **by design nicht** lösbar. Erreichbar und
sauber ist **Wallet-Login mit Wiedererkennung derselben Wallet** — verhindert
versehentliche Doppel-Accounts, aber keinen vorsätzlichen Missbrauch mit zweitem
Gerät. Restrisiko produktseitig/über Nicht-Wallet-Signale zu behandeln.
