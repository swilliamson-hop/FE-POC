# EU DI Wallet - Pilotprojekt

> **Letzte Aktualisierung:** 24. März 2026
> **Status:** POC 1 (PID-Präsentation) abgeschlossen & produktiv, POC 2 (Credential Issuance) Backend implementiert – wartet auf Wallet-Support

---

## Briefing: EUDI Wallet / DigiWoh Pilot (SPRIND + GDW) – Immomio POCs

Ich (@Stefan Williamson) befinde mich gerade in einem Pilot-/Onboarding-Prozess rund um die **deutsche EU Digital Identity Wallet (EUDI Wallet)**. Das Ganze läuft im Kontext des **DigiWoh-Piloten** (GDW) und der Organisation, die die deutsche Wallet mit aufbaut ([SPRIND](https://www.sprind.org/)). Ziel ist es, erste **Proof-of-Concepts (POCs)** zu bauen, wie Immomio Wallet-basierte Identitäten und digitale Nachweise in unsere Prozesse integrieren könnte.

Die EUDI Wallet ist Teil von **eIDAS 2.0** (EU-Regulierung) und wird perspektivisch in Europa eine Standardrolle für digitale Identitäten und Nachweise spielen – inklusive eines Ökosystems aus Wallet, Issuern, Verifiern, Registraren und Trust-Mechaniken.

**Bereitstellungspflicht:** Bis Ende 2026 müssen alle EU-Mitgliedsstaaten eine oder mehrere EUDI-Wallets für ihre Bürger bereitstellen. In Deutschland wird dies von SPRIND realisiert.

---

## Was ist die EUDI Wallet?

Die Wallet soll Nutzern ermöglichen:

- ihre **Personendaten (PID)** verifiziert zu halten (z. B. Name, Geburtsdatum, Adresse)
- sowie **digitale Nachweise / Credentials** (Attestations / EAAs), z. B. WBS, Bescheinigungen, Mitgliedschaften, etc.

Technisch basiert das Ökosystem stark auf **Zertifikaten / Trust-Registries**.

---

## Was wir bei Immomio damit vorhaben

Immomio bietet vollständig **digitale Prozesse** für Wohnungssuchende, Vermieter und Mieter. Entsprechend spielt das Thema **digitale Identität** je nach Prozess eine relevante bis hin zu geschäftskritischen Rolle – etwa bei digitaler Vertragssignatur (QES), Betrugsprävention oder der sicheren Übermittlung sensibler Nachweise (z. B. Einkommen, Bonität, WBS).

Allein im Vermietungsprozess ergeben sich bereits zahlreiche Anwendungsmöglichkeiten entlang der Customer Journey.

Im Rahmen des Pilotprojekts haben wir uns für folgende Use Cases beworben:

### Use Case 1: PID aus Wallet ins Immomio-Profil übernehmen (inkl. Anti-Fraud) ✅

Immomio fragt beim Bewerbungsprozess die PID aus der Wallet an.

**Value:** weniger manuelle Eingaben, bessere Datenqualität, weniger Abbrüche + **Fraud Prevention** (Fake Accounts), wo wir heute umständlich über **SMS-Verifikation** gehen.

**Status: Vollständig implementiert und End-to-End getestet** (siehe POC 1 unten).

### Use Case 2: WBS Credential / EAA aus Wallet abfragen (Painkiller für Vermieter)

Immomio fragt ein **WBS Credential** aus der Wallet ab.

**Value:** riesiger Painkiller, weil WBS-Validierung heute für Vermieter/WUs schwierig, manuell und fälschungsanfällig ist.

**Status:** Technisch vorbereitet (gleicher VP-Flow wie Use Case 1), aber es existiert noch kein WBS-Credential in der Sandbox-Wallet. Erfordert einen WBS-Issuer im Ökosystem.

### Use Case 3: Wohnungsgeberbestätigung als Credential ausstellen 🔄

Langfristig VC-Ausstellung in die Wallet.

Erkenntnis aus Call: **PubEAA** geht nur mit klarer nationaler Gesetzesgrundlage; sonst eher **EAA** oder ggf. **QEAA** (QEAA stärker reguliert, EAA einfacher).

**Status: Backend vollständig implementiert (POC 2), wartet auf SPRIND-Wallet Issuance-Support** (siehe POC 2 unten).

### Zusätzliche Vorteile / potenzielle Folge-Use-Cases

- **Wallet als Login** (PS Portal und/oder MieterApp)
- **QES Signatur** als perspektivischer Standard-Baustein → relevant für digitale Vertragssignatur
- Weitere EAAs: **Einkommen/Bonität, Genossenschafts-Mitgliedschaft** etc. (heute fehleranfällig über manuelle Plausiprüfung)

---

## Sandbox EU DI Wallet

Ich habe Zugang zur offiziellen Sandbox und **Immomio dort bereits als Relying Party registriert** (für Use Case 1 & 2).

**Registration Certificates** und **Access Certificates** wurden erstellt und sind aktiv. Immomio ist in der Sandbox vollständig als Relying Party registriert (Use Case 1 & 2). Der EUDI Wallet Service läuft produktiv auf Railway unter einer öffentlichen HTTPS-URL und kommuniziert erfolgreich mit der SPRIND Sandbox Wallet.

### Aktueller Stand Sandbox-Infrastruktur (März 2026)

| Komponente | Status | Details |
|-----------|--------|---------|
| Relying Party Registrierung | ✅ Aktiv | Use Case 1 & 2 |
| Access Certificate (ES256/P-256) | ✅ Aktiv | Leaf + Intermediate CA (German Registrar) |
| Trust List Integration | ✅ Aktiv | Neues ETSI TS 119 602 LoTE-Format seit März 2026 |
| EUDI Wallet Service | ✅ Deployed | Railway, öffentliche HTTPS-URL |
| PID-Präsentation (VP) | ✅ Funktioniert | Name, Geburtsdatum; Adresse Wallet-seitig noch nicht verfügbar |
| Credential Issuance (VCI) | ⏳ Wartet | Backend ready, SPRIND-Wallet unterstützt Issuance noch nicht |

---

## Entwicklung der POCs für das Pilotprojekt

### POC 1: PID-Präsentation (OpenID4VP) ✅

Der Frontend-POC ist fertiggestellt und **Use Case 1 wurde erfolgreich End-to-End getestet**. Der vollständige OpenID4VP-Flow funktioniert:

- Immomio agiert als registrierte Relying Party und fragt per **DCQL-Query** gezielt PID-Felder an (Vorname, Nachname, Geburtsdatum, Adresse)
- Der EUDI Wallet Service (Node.js/TypeScript, deployed auf Railway) übernimmt Schlüsselgenerierung, JAR-Signierung, VP-Token-Validierung (7 Sicherheitsschichten) und Session-Management
- Das Frontend (Next.js) zeigt je nach Gerät einen **QR-Code** (Desktop/Cross-Device) oder einen **Deep Link** (Mobile/Same-Device)
- Nach Zustimmung des Nutzers in der Wallet werden die verifizierten PID-Daten automatisch in das Bewerbungsformular übernommen
- Befüllte Felder werden mit einem **„Aus Wallet"-Badge** gekennzeichnet (Vorname, Nachname, Geburtsdatum, Straße, PLZ, Stadt)

**Technischer Stack:**

| Komponente | Technologie |
|-----------|-------------|
| Backend | Node.js + Hono + TypeScript, deployed auf Railway |
| Protokoll | OpenID4VP mit SD-JWT, JWE-Verschlüsselung, Access Certificate (ES256/P-256) |
| Frontend | Next.js + Tailwind CSS |
| Frontend-Features | QR-Code-Anzeige, automatisches Polling, "Aus Wallet"-Badges, EUDIW-Logo |

**PPT-Slides zum POC 1:**

- Flow Diagramm / Beschreibung des Services: `EUDI-Wallet-Service-Deep-Dive.pptx`
- Optische Eindrücke: `EUDI_Wallet_Bewerbungsflow.pptx`

### POC 2: Credential Issuance (OpenID4VCI) 🔄

POC 2 erweitert die Plattform um die **Ausstellung von Credentials in die Wallet**. Der vollständige OpenID4VCI-Flow (Pre-Authorized Code) wurde implementiert:

**Zwei Credential-Typen als Demo:**

| Credential | VCT | Felder aus PID | Mock-Felder |
|-----------|-----|---------------|-------------|
| Wohnungsgeberbestätigung | `urn:credential:wohnungsgeberbestaetigung:1` | Vorname, Nachname, Geburtsdatum | Adresse, Einzugsdatum, Vermieter |
| Genossenschafts-Mitgliedsbescheinigung | `urn:credential:genossenschaft-mitglied:1` | Vorname, Nachname, Geburtsdatum | Genossenschaft, Mitgliedsnummer, Beitrittsdatum |

**User Flow:**

```
/ausstellen → Credential-Typ wählen
    ↓
Schritt 1: PID-Verifikation (bestehender OpenID4VP-Flow)
    ↓ Wallet präsentiert PID
Schritt 2: Credential-Vorschau (PID-Daten + Mock-Daten)
    ↓ User klickt „Ausstellen"
Schritt 3: QR-Code / Deep Link (openid-credential-offer://)
    ↓ Wallet holt Metadata → Token → Credential
Schritt 4: Erfolg – Credential ist in der Wallet
```

**Backend-Endpoints (alle implementiert):**

| Endpoint | Methode | Zweck |
|----------|---------|-------|
| `/.well-known/openid-credential-issuer` | GET | Issuer Metadata |
| `/.well-known/oauth-authorization-server` | GET | OAuth Server Metadata |
| `/issuer/initiate` | POST | VP-Session + Issuance-Session erstellen |
| `/issuer/link-pid` | POST | PID-Claims von VP-Session übertragen |
| `/issuer/create-offer/:id` | POST | Credential Offer generieren |
| `/issuer/offer/:id` | GET | Credential Offer JSON für Wallet |
| `/issuer/token` | POST | Pre-Auth Code → Access Token + c_nonce |
| `/issuer/credential` | POST | Proof-of-Possession validieren, SD-JWT-VC ausstellen |
| `/issuer/nonce` | POST | Frischen c_nonce liefern |
| `/issuer/result/:id` | GET | Frontend pollt Issuance-Status |

**Credential-Format:** SD-JWT-VC (`vc+sd-jwt`) mit selektiver Offenlegung via `@sd-jwt/core`

**Aktueller Status:**
- ✅ Backend vollständig implementiert und deployed
- ✅ Frontend (Credential-Auswahl, PID-Verifikation, Vorschau, QR-Code) implementiert
- ❌ SPRIND-Wallet unterstützt OpenID4VCI Credential-Empfang noch nicht (Wallet crasht beim Versuch)
- ⏳ Warten auf nächstes SPRIND-Wallet-Release mit Issuance-Support

**PPT-Slides zum POC 2:** Slides 13–19 in `EUDI_Wallet_Integration.pptx`

---

## Erkenntnisse aus der Umsetzung

### POC 1 (PID-Präsentation)

- Das **Zertifikats-Setup** ist der aufwändigste Teil des Onboardings: Leaf-Zertifikat allein reicht nicht – die Intermediate CA (German Registrar) muss explizit mitgeliefert werden
- Die SPRIND Demo-Wallet enthält aktuell **keine Adressdaten im PID** – Name und Geburtsdatum werden übertragen, Adressfelder bleiben leer (kein Blocker, da PID-Spezifikation Adresse optional lässt)
- **Claim-Naming** ist nicht trivial: ARF-Spezifikation und OIDC-Standard weichen stellenweise ab (z. B. `birthdate` vs. `birth_date`) – hier ist Präzision entscheidend
- Das **QR-Code-Flow** (Cross-Device) funktioniert zuverlässig für Desktop-Demos; Same-Device (Mobile) erfordert, dass das Frontend auf einer öffentlichen URL erreichbar ist
- Die Wallet prüft aktiv, ob die Relying Party in der **Trust List** registriert ist und ob der ephemeral Key korrekt konfiguriert ist – fehlerhafte Konfigurationen führen zu `invalidClientMetadata` ohne hilfreiche Fehlermeldung
- **client_id-Schema** muss `x509_hash:<sha256>` sein (nicht die URL) – Wallet validiert den Hash gegen das Leaf-Zertifikat im x5c-Header

### POC 2 (Credential Issuance)

- Die SPRIND-Wallet **unterstützt Credential-Empfang (OpenID4VCI) noch nicht** – Wallet crasht beim Öffnen des `openid-credential-offer://` Deep Links (Stand März 2026)
- **Credential Refresh** wird von der Wallet ebenfalls noch nicht unterstützt (Bestätigung von mirko.mollik im Forum)
- Das **Blueprint** empfiehlt für Issuance zusätzlich: DPoP Token-Binding, Wallet Attestation, signierte Metadata – alles Features, die die SPRIND-Wallet vermutlich noch nicht prüft
- Für unseren POC reicht der **Pre-Authorized Code Flow** (einfachster Flow, kein Auth-Server nötig)
- **Revocation vs. Laufzeit**: Für POC-Credentials (Wohnungsgeberbestätigung) empfiehlt sich kurze Laufzeit ohne Revocation (Blueprint-Empfehlung: max. 36 Monate, Use-Case-abhängig)

### Infrastruktur-Updates (März 2026)

- **Trust Lists**: Breaking Change im März 2026 – neues ETSI TS 119 602 LoTE-Format. Alte `entries[].x5t#S256`-Thumbprints wurden durch verschachtelte Zertifikatsstruktur ersetzt. Parser wurde angepasst.
- **DCQL-Query**: `id`-Properties auf jedem Claim + nested paths für Adressfelder (z. B. `['address', 'street_address']`). Adressfelder werden von der Wallet trotzdem nicht angezeigt.
- **Immomio Property-IDs**: Backend-Migration von numerischen IDs auf UUIDs. Default-Property-ID im POC aktualisiert.

---

## Migration / Neubau / Cookie Cutter

Der POC wurde bewusst schnell gebaut, um Use Case 1 & 3 technisch zu validieren.

Sobald das Cookie-Cutter-Template zur Verfügung steht, müsste er einmal migriert/neu gebaut werden. Zu wann ist dies angedacht?

---

## Architecture & Reference Framework (ARF)

### Was ist das ARF?

Das **Architecture & Reference Framework (ARF)** ist die technische Referenzarchitektur für das EUDI-Wallet-Ökosystem. Es ist kein Gesetz, sondern eine von der EU koordinierte technische Blaupause, die beschreibt:

- welche Rollen es im Ökosystem gibt (Wallet, Issuer, Relying Party, Registrars, Trust Lists)
- wie diese Rollen technisch interagieren
- welche Sicherheits- und Datenschutzmechanismen vorgesehen sind
- welche Standards und Protokolle für Interoperabilität erwartet werden

**Wichtig:** Auch wenn das ARF nicht direkt „rechtlich bindend" ist, ist es in der Praxis die Grundlage für technische Spezifikationen, nationale Implementierungen und Sandbox-Setups.

### Warum ist das ARF für unsere Immomio-Use Cases relevant?

Unsere drei Use Cases (PID abfragen, WBS/EAA abfragen, Wohnungsgeberbestätigung ausstellen) bewegen sich exakt innerhalb der im ARF definierten Rollen und Trust-Mechanismen.

Das ARF macht sehr klar:

- **Issuer** (Attestation Provider) und **Relying Party** sind technisch und organisatorisch getrennte Rollen.
- Wallets prüfen Trust nicht „weich", sondern über Registrierungen, Zertifikate und Trust-Mechanismen.

### Trust & Registrierung: Warum „Relying Party Registration" nicht optional ist

Für Use Case 1 (PID abfragen) und Use Case 2 (WBS/EAA abfragen) agiert Immomio als **Relying Party**.

Das ARF beschreibt, dass Relying Parties sich registrieren müssen und dabei u. a. angeben, welche Attribute sie anfragen möchten. Wallets können (je nach User-Einstellung) prüfen, ob die angefragten Attribute im Rahmen der registrierten Rechte liegen und den Nutzer warnen, wenn das nicht passt.

**Praktische Konsequenz für uns:**
Die Sandbox führt das bereits konkret aus: nach der Registrierung folgen Registration Certificates und Access Certificates, bevor Requests technisch möglich sind.

### Issuer / Attestation Provider: Separate Onboarding- und Trust-Pfade

Für Use Case 3 (Wohnungsgeberbestätigung ausstellen) bewegen wir uns nicht mehr im Relying-Party-Modell, sondern im **Issuer-Modell**.

Das ARF behandelt Attestation Provider als eigenständige Rolle mit:

- eigenen Trust-Anforderungen
- eigenen Zertifikats-/Registrierungsmechaniken
- eigener Governance (wer darf welche Attestations ausstellen?)

**Praktische Konsequenz für uns:**
Für den Use Case „Wohnungsgeberbestätigung" reicht Relying Party Registration nicht aus. Wir müssen klären, wie Issuer-Onboarding und Trust-Listen im deutschen Ökosystem konkret gehandhabt werden.

**Update März 2026:** Die BMI Blueprint-Dokumentation enthält jetzt detaillierte Kapitel zu EAA-Issuance inkl. OID4VCI-Protokollflow, Endpoint-Spezifikationen und Trust-Anforderungen. Siehe [Quellen & Referenzen → BMI Blueprint](#quellen--referenzen).

### Interoperabilität: Warum Rulebooks/Schemas ein Branchenproblem sind

Ein zentraler Punkt im ARF ist Interoperabilität:

Credentials müssen so definiert sein, dass Wallets und Verifier EU-weit konsistent damit umgehen können. Die Wallet selbst standardisiert jedoch nicht automatisch die Semantik einer Branche. Das heißt:

Die Wohnungswirtschaft muss sich für EAAs (z. B. WBS, Mitgliedsbescheinigungen, etc.) auf ein gemeinsames **Rulebook** einigen, damit Verifier wissen, welche Attribute sie anfragen müssen und wie sie zu interpretieren sind.

**Konsequenz:**
Ein technisch funktionierendes Wallet-Setup allein reicht nicht. Ohne ein Branchen-Rulebook bleibt der Nutzen im Alltag begrenzt oder fragmentiert.

---

## Quellen & Referenzen

Eine vollständige, strukturierte Quellensammlung aller verwendeten Spezifikationen, Blueprint-Dokumentation, Libraries und Forum-Erkenntnisse findet sich auf der separaten Confluence-Seite:

**→ [EUDI Wallet – Quellen & Referenzen](#)**

---

## Glossar (kurz & Immomio-relevant)

### Wallet / Wallet Unit

Die **Wallet** ist die App/Komponente des Users, in der:

- die PID (verifizierte Personendaten)
- und Attestations/EAAs (digitale Nachweise)

gespeichert werden.

Die Wallet steuert außerdem:

- Consent des Nutzers
- Präsentation (Presentation) an Relying Parties
- Trust Checks (z. B. ob ein RP registriert ist)

### PID (Person Identification Data)

Verifizierte Personendaten, die typischerweise staatlich oder staatlich-nah bereitgestellt werden (z. B. Name, Geburtsdatum, Adresse).

**Immomio-Relevanz:** Use Case 1 (Stammdatenübernahme + Anti-Fraud)

### EAA (Electronic Attestation of Attributes)

Ein digitaler Nachweis über Attribute (z. B. „hat WBS", „ist Genossenschaftsmitglied", „Einkommen X"). EAAs sind die generische Kategorie für Credentials im EUDI-Kontext.

**Immomio-Relevanz:** Use Case 2 (WBS, Mitgliedschaft, Bonität etc.) und Use Case 3 (Wohnungsgeberbestätigung als EAA)

### QEAA (Qualified Electronic Attestation of Attributes)

Eine „qualifizierte" EAA, mit deutlich strengeren Anforderungen (Trust Service Provider / Zertifikate / Auflagen).

Im Call kam die Aussage: **QEAA ist restriktiver, EAA ist einfacher.**

### PubEAA (Public Electronic Attestation of Attributes)

EAAs aus dem Public-Sector-Kontext.

**Wichtige Erkenntnis aus dem Call:** PubEAA erfordert in der Regel eine klare nationale Gesetzesgrundlage („nur bestimmte Stellen dürfen X ausstellen"). Ohne diese Grundlage bleibt eher EAA/QEAA.

### Issuer / Attestation Provider

Der **Issuer** (auch: Attestation Provider) stellt eine Attestation/EAA aus.

Beispiele:

- Stadt / Behörde (für bestimmte Nachweise)
- Arbeitgeber (für Beschäftigungsnachweise)
- Genossenschaft (für Mitgliedschaft)
- Wohnungsunternehmen (für wohnungswirtschaftliche Nachweise)

**Immomio-Relevanz:** Use Case 3 (Issuer-as-a-Service im Auftrag von Wohnungsunternehmen)

### Holder

Der Nutzer, der das Credential besitzt (in der Wallet hält) und präsentiert.

**Immomio-Relevanz:** Wohnungssuchender / Bewerber / Mieter

### Relying Party (RP)

Ein Service Provider, der Attribute aus der Wallet anfragt (z. B. um einen Prozess zu automatisieren).

Relying Parties müssen typischerweise:

- registriert sein
- Attribute deklarieren
- Zertifikate nutzen, um Requests zu signieren

**Immomio-Relevanz:** Use Case 1 & 2

### Relying Party Registrar

Eine (staatliche/nationale) Registrierungsstelle, bei der Relying Parties registriert werden. Sie führt eine Art „Telefonbuch" legitimer Relying Parties und deren erlaubter Attribute.

**Immomio-Relevanz:** Immomio muss dort registriert sein, um PID/WBS etc. abfragen zu dürfen

### Registration Certificate vs. Access Certificate (Sandbox)

In der Sandbox tauchen zwei Zertifikatstypen auf:

- **Registration Certificate:** Nachweis der RP-Identität gegenüber dem Registrar / Ökosystem
- **Access Certificate:** Zertifikat, das in der konkreten Anwendung genutzt wird, um Requests zu signieren

**Immomio-Relevanz:** Erforderlich für Use Case 1 & 2 in der Sandbox

### SD-JWT-VC (Selective Disclosure JWT – Verifiable Credential)

JSON-basiertes Credential-Format mit eingebauter selektiver Offenlegung. Der Nutzer kann beim Präsentieren auswählen, welche Felder er freigeben möchte.

**Immomio-Relevanz:** Format für PID-Präsentation (POC 1) und Credential-Ausstellung (POC 2)

### OpenID4VP / OpenID4VCI

- **OpenID4VP** (Verifiable Presentations): Protokoll, mit dem eine Relying Party Credentials aus der Wallet anfragt
- **OpenID4VCI** (Verifiable Credential Issuance): Protokoll, mit dem ein Issuer Credentials in die Wallet ausstellt

**Immomio-Relevanz:** OpenID4VP für Use Case 1 & 2, OpenID4VCI für Use Case 3

### DCQL (Digital Credentials Query Language)

Abfragesprache im VP-Request, mit der die Relying Party spezifiziert, welche Credential-Typen und welche Felder sie anfragt.

**Immomio-Relevanz:** Definiert welche PID-Felder (Name, Geburtsdatum, Adresse) Immomio anfordert
