# FirmaCheck

Webová aplikace pro rychlé ověření základních údajů o české firmě podle **IČO**. Data se načítají z rejstříku **ARES**, sídlo firmy se zobrazí na mapě (**Mapy.cz**), odpovědi se ukládají do jednoduché **SQLite cache**, ověřené firmy lze uložit do seznamu a exportovat do **CSV/JSON**.

**🔗 Živé demo:** _zatím nenasazeno — doplním URL z Coolify po nasazení._

![Babička z FirmaCheck](app/assets/img/babicka.webp)

---

## Co aplikace umí

- Ověření firmy podle IČO (s volitelnou kontrolou názvu) přes ARES API.
- Zobrazení **stavu ověření** a **zdroje dat** (ARES API / SQLite cache) u každého výsledku.
- Kontrola shody zadaného názvu s názvem v ARESu (shoda / částečná shoda / neshoda).
- Geocoding adresy sídla a její zobrazení na mapě s markerem, souřadnicemi a odkazem do Mapy.cz.
- Uložení ověřených firem do seznamu, jejich opětovné otevření a odebrání (zůstávají i po obnovení stránky).
- Stránkování uloženého seznamu (5 firem na stránku).
- Export uložených firem do **CSV** a **JSON**, kopírování JSON do schránky a export jednotlivé firmy.

---

## Technologický stack

| Vrstva           | Technologie                                           |
| ---------------- | ----------------------------------------------------- |
| Framework        | **Nuxt 4** (Vue 3) + Nitro server routes              |
| UI               | **Nuxt UI** (Tailwind v4)                             |
| Validace         | **Zod** (sdílené schéma klient + server)              |
| Databáze / cache | **better-sqlite3** (server-side, perzistentní soubor) |
| Mapa             | **Leaflet** + dlaždice **Mapy.cz**                    |
| Testy            | **Vitest**                                            |
| Nasazení         | **Docker** přes **Coolify** (vlastní server)          |

---

## Použité API služby

- **ARES** – `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}` – registr ekonomických subjektů, vyhledání firmy podle IČO.
- **Mapy.cz REST API** – `https://api.mapy.cz/v1/geocode` pro geocoding adresy a `https://api.mapy.com/v1/maptiles/...` pro mapové dlaždice. Vyžaduje API klíč.

---

## Lokální spuštění

1. Naklonujte repozitář a nainstalujte závislosti (používá se **pnpm**):

   ```bash
   pnpm install
   ```

2. Zkopírujte `.env.example` na `.env` a doplňte API klíč z [developer.mapy.com](https://developer.mapy.com):

   ```bash
   NUXT_MAPY_API_KEY=vas_klic
   NUXT_PUBLIC_MAPY_API_KEY=vas_klic
   NUXT_DB_PATH=./data/firmacheck.db
   ```

   > Mapy.com poskytuje **jeden** API klíč. Vyplňte stejnou hodnotu do obou proměnných: `NUXT_MAPY_API_KEY` se používá server-side pro geocoding (skrytý), `NUXT_PUBLIC_MAPY_API_KEY` se používá v prohlížeči pro mapové dlaždice (klíč lze v dashboardu Mapy.com omezit na doménu).
3. Spusťte vývojový server:

   ```bash
   pnpm dev    # http://localhost:3000
   ```

4. Testy:

   ```bash
   pnpm test
   ```

---

## Architektura a klíčová rozhodnutí

Prohlížeč nikdy nevolá ARES ani Mapy.cz přímo — všechny externí dotazy procházejí přes Nitro server routes (`server/api/*`). Díky tomu zůstává API klíč skrytý, každá odpověď se cachuje v SQLite a UI ví, zda data pochází z API nebo z cache.

### Self-hosting místo Vercel/Netlify

Zadání v sekci o SQLite výslovně připouští **vlastní server** jako řešení perzistence. Zvolil jsem self-hosting přes **Coolify** (Docker), protože vlastní server má perzistentní filesystem, a můžu tak použít klasickou server-side SQLite (`better-sqlite3`) — nejjednodušší a nejpřímočařejší výklad zadání. Pro serverless platformu (Vercel/Netlify) bych použil cloud SQLite (Turso/libSQL) nebo browser-side WASM SQLite.

### SQLite cache

- Tabulka `ares_cache` (klíč = IČO) ukládá normalizovanou odpověď z ARESu.
- Tabulka `geocode_cache` (klíč = normalizovaná adresa) ukládá souřadnice z geocodingu.
- První dotaz jde na API a uloží se; opakovaný dotaz na stejné IČO / stejnou adresu se obslouží z cache. Geocode cache je sdílená napříč firmami se stejnou adresou.
- U každého výsledku aplikace viditelně zobrazuje, zda data pochází z **API** nebo ze **SQLite cache** (barevné odznaky).
- Cache nemá TTL (je perzistentní); ukládá se i čas načtení (`fetched_at`).

### Ukládání firem

Uložené firmy žijí ve stejné SQLite databázi (tabulka `saved_companies`) — jednotná architektura se stejným úložištěm jako cache. Jde o **jeden globální seznam** bez přihlašování, což je pro demo v pořádku; per-user seznamy by vyžadovaly autentizaci. Seznam přežívá obnovení stránky i restart serveru (DB je na perzistentním svazku).

### CSV / JSON export

Export se generuje server-side z reálných uložených řádků (`server/api/companies/export.get.ts`).
CSV používá oddělovač `;` a UTF-8 BOM kvůli kompatibilitě s českým Excelem; má hlavičku a sloupce: IČO, obchodní název, právní forma, stav, adresa, datum vzniku, datum posledního ověření, zdroj načtení (API/cache) a souřadnice. Pole obsahující oddělovač, uvozovky nebo nový řádek se escapují podle RFC 4180. JSON export, „Kopírovat JSON do schránky" a export jednotlivé firmy (`?ico=`) jsou bonusové funkce.

### Validace IČO

IČO se validuje nejen na 8 číslic, ale i kontrolním součtem mod-11 (`shared/ico.ts`). Stejné Zod schéma (`shared/schema.ts`) se používá jak ve formuláři (Nuxt UI `UForm` s inline chybami), tak na serveru v `/api/verify`.

---

## Použité AI nástroje

- **Claude Code (Opus 4.7)** — návrh architektury a specifikace, implementace (TDD), integrace ARES a Mapy.cz, testy, Docker, dokumentace. Vývoj probíhal stylem „spec → plán → implementace po krocích" s průběžným review.
- **ChatGPT (GPT Image)** — vygenerování vizuálního prvku (ilustrace babičky).

### AI vizuální prvek

Ilustrace **„babička s lupou za záclonou"** (`app/assets/img/babicka.webp`) — vtipná postavička české zvědavé sousedky, která „kontroluje" firmy stejně jako kouká po sousedech. Použitá v hero sekci a v prázdném stavu seznamu uložených firem, aby aplikace působila přívětivě a měla osobitý český nádech. Vygenerováno v **ChatGPT**, exportováno jako PNG s průhledným pozadím a zoptimalizováno do WebP (~77 kB).

**Použitý prompt:**

> Vtipná, chytrá plochá vektorová ilustrace klasické české babičky jako zvědavé „kontrolorky firem". Starší žena s růžovými tvářemi vykukuje zpoza bílé krajkové záclony v okně, jedno oko přitisknuté k velké lupě — oko je přes čočku žertovně zvětšené. Výraz laskavý, ale komicky podezíravý: zvednuté obočí, šibalský úsměv, jako že nic nepřehlédne. Má šátek uvázaný pod bradou a svetřík s decentními akcenty v českých národních barvách (červená, bílá, modrá). Na okenním parapetu kvetoucí muškát v květináči. Moderní přátelský kreslený styl, oblé tvary, jemná struktura papíru, měkké čisté světlo, omezená paleta červená/bílá/modrá a teplé neutrální tóny. Transparentní pozadí. Formát 1:1, vysoké rozlišení.

### Ukázky promptů z vývoje (Claude Code)

1. **Architektura a výklad zadání:**

   > „Studuj assignment.md slovo od slova. Pojďme nejdřív probrat tech stack a architekturu. Je tam doporučený stack, ale taky se píše, že appka musí mít nasazené demo na Vercel nebo Netlify — já bych to ale radši hostoval kompletně na vlastním serveru. Jak to čteš?"

2. **Využití existujícího kódu jako reference:**

   > „Na mém GitHubu je projekt ‚fz', kde mám implementaci ARES. Ale je to starý projekt, takže pokud se k němu nedostaneš, nevadí — vždy raději použij oficiální dokumentaci."

3. **Doladění UI:**
   > „Pár věcí k rychlé opravě: 1) klikací tlačítka potřebují cursor: pointer, 2) když je firma už uložená, místo tlačítka ‚Uložit firmu' má být disabled tlačítko ‚Uloženo', 3) použij Nuxt UI pagination pro Uložené firmy — max 5 na stránku."

### Popis iterací

1. **Volba úložiště a hostingu.** První úvaha směřovala k serverless nasazení (Vercel/Netlify), které by ale vyžadovalo browser-side WASM SQLite nebo cloud SQLite (Turso). Po opětovném pročtení zadání (které „vlastní server" výslovně připouští) jsem se rozhodl pro self-hosting přes Coolify s klasickou server-side `better-sqlite3` — jednodušší a zároveň to umožnilo sjednotit cache i seznam uložených firem do jedné databáze.

2. **Mapování stavu subjektu z ARESu.** Po stažení reálné odpovědi ARESu pro IČO `02823519` se ukázalo, že „stav subjektu" není přímé pole — odvozuje se ze sekce `seznamRegistraci` podle primárního zdroje (`primarniZdroj` → `stavZdrojeRos: AKTIVNI`). Funkci `deriveStatus` jsem podle toho implementoval, doplnil mapu kódů právních forem (`pravniForma: "112"` → „Společnost s ručením omezeným") a ošetřil chybové stavy (404 → nenalezeno, nevalidní JSON apod.).

3. **Drobnosti z reálného provozu.** Tailwind v4 zrušil výchozí `cursor: pointer` na tlačítkách (doplněno globálně) a pnpm 11 v Docker buildu vyžadoval povolení native build skriptů pro `better-sqlite3` — vyřešeno v Dockerfile a konfiguraci pnpm.

---

## Co bych vylepšil s více času

- **Reprodukovatelný build** — připnout `packageManager` (pnpm) v `package.json`, aby lokální prostředí i Docker používaly stejnou verzi pnpm, a sjednotit konfiguraci native buildů.
- **TTL / invalidace cache** — nyní je cache perzistentní bez expirace; přidal bych obnovu starých záznamů.
- **Per-user seznamy s přihlášením** — místo jednoho globálního seznamu.
- **Úplný číselník právních forem** z oficiálního zdroje ARES místo vybrané podmnožiny.
- **E2E testy (Playwright)** — ve vývojovém prostředí nebyl k dispozici prohlížeč pro automatické klikací testy.
- **Omezení veřejného Mapy klíče na doménu** v produkci.

---

## Nasazení (Coolify)

1. Nasaďte z GitHub repozitáře pomocí přiloženého `Dockerfile`.
2. Připojte **perzistentní svazek** na adresář `/app/data` — bez něj se SQLite databáze smaže při každém nasazení.
3. Nastavte proměnné prostředí: `NUXT_MAPY_API_KEY`, `NUXT_PUBLIC_MAPY_API_KEY`, `NUXT_DB_PATH=/app/data/firmacheck.db`.
4. Exponujte port `3000` a přiřaďte doménu.

---

## Čas strávený

_Přibližně 2 hodiny._
