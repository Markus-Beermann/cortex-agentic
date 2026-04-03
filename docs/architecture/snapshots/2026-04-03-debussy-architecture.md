# Architektur-Snapshot: Debussy-Vision
Datum: 2026-04-03
Status: Ziel-Architektur — noch nicht vollständig implementiert

## Mermaid

```mermaid
graph TD
    Markus["Markus\nGoal · Entscheidung · Intent"]
    Dashboard["Dashboard · Mobile\nDie Schnittstelle zu Debussy"]

    Debussy["Claude Debussy\nKomponist · Neuronale Schnittstelle\nRouting · Guardrails · Kontext\nEntscheidet: wer, wann, warum"]

    Michael["Michael Angelo\nArchitekt\nStruktur · Design · Schnittstellen"]
    Tony["Tony Stark\nPrototyp · Außendarstellung\nBaut · Präsentiert"]
    DINo["DINo\nDIN · Normen · Recht · Policy\nReview · Compliance"]
    Sigmund["Sigmund Freud\nPsychologe · Ethik\nReflexion · Kritik"]
    Hermes["Hermes\nMonitoring · Nightly\nGitHub · LinkedIn · Mail"]

    DB[("Railway PostgreSQL\nState · Feed · Outputs · Deferred Tasks")]

    Markus -->|"Goal rein"| Dashboard
    Dashboard <-->|"Fragen · Approvals · Status"| Debussy
    Dashboard -->|"Markus liest · antwortet"| Markus

    Debussy -->|"wenn Struktur nötig"| Michael
    Debussy -->|"wenn Bau nötig"| Tony
    Debussy -->|"wenn Norm/Review nötig"| DINo
    Debussy -->|"wenn Reflexion nötig"| Sigmund

    Michael -->|"Frage offen"| Debussy
    Tony -->|"Frage offen"| Debussy
    DINo -->|"Policy-Konflikt"| Debussy
    Sigmund -->|"Ethik-Flag"| Debussy

    Hermes -.->|"async · background"| DB
    Debussy --- DB
    Tony --- DB
    Michael --- DB
    DINo --- DB
```

## Was sich gegenüber v1 geändert hat

- George war Coordinator-Persona → ersetzt durch Claude Debussy
- George Orwell neu: direkte Implementierungsrolle für klaren, lesbaren Code ohne Bullshit
- Debussy ist nicht eine Rolle im Run — Debussy *ist* der Run
- Dashboard = Schnittstelle Markus↔Debussy, nicht nur Visualisierung
- Sigmund Freud neu: Ethik, Psychologie, Reflexion, Kritik
- Tony Stark erweitert: nicht nur Implementer, auch Außendarstellung
- DINo geschärft: DIN/Normen/Recht/Policy, nicht nur "Reviewer"
- deferred_tasks: Aufgaben können für später gespeichert werden

## Noch nicht implementiert
- Frage-Routing Tony→Debussy→Markus via Dashboard
