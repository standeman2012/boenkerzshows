# Radiostation Planning-App — Bouwplan

Dit is een groot project. Ik bouw het in duidelijke fases zodat we tussentijds kunnen bijsturen. Alles draait op Lovable Cloud (database + auth + storage + realtime) zodat elk account op elk apparaat werkt en wijzigingen live gedeeld worden.

## Fase 1 — Fundament & Design system

- Lovable Cloud activeren (database, auth, storage, realtime).
- Design tokens in `src/styles.css`: wit, groen (~#78B94A), turquoise accent, lichtgrijze borders, radius 8–12px, subtiele shadows, Inter font.
- App shell: inklapbare sidebar links, smalle header met logo/tekst, zoekveld, notificatie-icoon, avatar rechts.
- Sidebar-items: Startpagina, Programma's, Programmagids, Presentatoren, Instellingen (+ Gebruikers alleen voor admin).

## Fase 2 — Accounts & Auth

- Login-scherm met accountkeuze-tegels: Admin + 19 presentatoren (Stan De Cock, Conan Heeren, …, Lars Dobbelaere).
- Startwachtwoord per account: `ikben<voornaam>` (bv. `ikbenstan`). Admin-wachtwoord NIET zichtbaar op login-pagina.
- Bij eerste login → verplicht wachtwoord wijzigen.
- Profiel: initialen (voornaam+achternaam) óf profielfoto uploaden vanaf laptop/gsm (Cloud Storage).
- Rollen: `admin` en `presentator` (aparte `user_roles` tabel, RLS).
- Admin kan gebruikers aanpassen/verwijderen en per gebruiker per programma bewerkrechten instellen (default: alleen-lezen).

## Fase 3 — Presentatoren tab

- Alleen-lezen overzicht van alle presentatoren (admin niet zichtbaar in deze lijst).
- Niet aanpasbaar door wie dan ook.

## Fase 4 — Programma's (shows aanmaken)

- Alleen admin kan aanmaken/bewerken/verwijderen. Anderen zien alleen.
- Velden: naam, beschrijving, presentator (uit presentatorenlijst), type: `live` (blauw), `non-stop` (rood), `opgenomen` (groen).

## Fase 5 — Programmagids (drag-to-schedule)

- Weekweergave maandag → zondag, dag = 00:00–24:00, verticale tijdlijn.
- Sleep-blok maken zoals in referentievideo: bovenaan het blok live begin- en einduur die meebewegen tijdens slepen.
- Klik op leeg blok → show kiezen uit aangemaakte programma's.
- Herhaling: eenmalig / dagelijks / wekelijks (zelfde uur, zelfde weekdag), met start- en einddatum.
- Meerdere uren-shows overspannen alle betrokken uren visueel.
- Alleen admin kan plaatsen/verplaatsen; anderen zien alleen.

## Fase 6 — Startpagina (dag/week-overzicht)

- Kolommen per dag (ma → zo), blokken per geplande show (geen uur-labels, alleen blokken zoals in video).
- Klik op show-instantie (bv. "Bas Breekt De Week – 5 april") → draaiboek van díe specifieke uitzending.
- Geen aanmaken hier.

## Fase 7 — Draaiboek per uitzending

- Bereikbaar alleen via klik op show op startpagina (geen aparte "Draaiboek" pagina in menu).
- Leeg draaiboek toont knop **"CREËER EERSTE ITEM"**.
- Bij toevoegen keuze uit 4 types:
  - **Item** (groen) — naam + duur (default 1 min) → opent rechts een rich-text editor (Google Docs-achtig, met opmaak).
  - **Song** (lichtblauw) — artiest + titel + duur, geen tekstvenster.
  - **Jingle** (geel) — titel, geen tekstvenster.
  - **Ander** (rood) — titel + beschrijving + duur, optioneel tekstvenster.
- Links: geordende itemlijst (1e, 2e, …), sleep om te herordenen.
- Rechts: rich-text editor per item, autosave, zichtbaar voor iedereen.
- Bewerkrechten per programma (zie Fase 2): wie geen recht heeft, kan alleen lezen.
- Realtime co-editing: naast het cursor-streepje kleine voornaam van wie er typt.

## Fase 8 — Instellingen (admin)

- Achtergrond uploaden.
- Logo: keuze tekst óf logo-upload; logo vervangt "boenkerz"-tekst in header.
- Wijzigingen zichtbaar voor iedereen (realtime).

## Fase 9 — Realtime & Persistentie

- Alle data (programma's, planning, draaiboeken, teksten, instellingen, profielen) in Cloud DB, met RLS.
- Realtime kanalen voor: planning, draaiboek-items, rich-text content, instellingen.
- Autosave overal.

## Techniek

- React + TypeScript, Tailwind, shadcn/ui, TanStack Router/Query.
- Rich-text: TipTap (Google Docs-achtige toolbar, collaboratie-cursors met presence).
- Drag-schedule: custom pointer-events op tijdlijn.
- Auth via Lovable Cloud email/password (accounts vooraf aangemaakt met `<voornaam>@boenkerz.local` intern; gebruiker kiest tegel → wachtwoord).

## Wat weggehaald wordt t.o.v. template

- Menu-items Campagnes, Sjablonen, Gebruikers (behalve admin), Draaiboek (als menu), Uitzendingen — bestaan niet.

## Vraag vóór ik begin

Dit is heel groot; ik stel voor dat ik nu **Fase 1 + 2 + 3** in één keer bouw (fundament, login/accounts, presentatoren), zodat je snel iets bruikbaars ziet, en daarna Fase 4–9. Akkoord? Of wil je dat ik meteen alles in één keer probeer? Oké maar zorg wel dat ik het allemaal vandaag kan doen en dat mijn credits niet opzijn. Als ze wel opzouden zijn na fase 1 2 en 3 dan doe je ze allemaal