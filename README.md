# Tail Survivors (radni naziv)

Offline Android survivor igra. Jednim prstom upravljaš smjerom glave zmije; svaki segment repa je slot oružja.
Runda traje 10 minuta, boss na 5. i 10. minuti. Pobijedi ako ubiješ drugog bossa.

- Portret, samo dodir, igra se jednom rukom, potpuno offline.
- Stack isti kao `merge-defense`: HTML5 canvas + vanilla JS u Capacitor omotaču (`www/`).
- Sva grafika i zvuk su generisani kodom (canvas + WebAudio), nema asseta.

## Pokretanje lokalno

```bash
cd www && python3 -m http.server 8080      # pa otvori http://localhost:8080 (u mobilnom prikazu browsera)
# ili: npm install && npm start
```

Balans/sanity test (bot igra pune runde na pravom game core-u, bez browsera):

```bash
npm run sim            # node tools/sim.js [broj_rundi]  (dodaj --god za besmrtnu glavu)
```

## Izgradnja APK-a

Svaki `git push` (bilo koja grana) pokreće GitHub Actions workflow `.github/workflows/build-apk.yml`:

1. `npm ci`, `node tools/sim.js 3`
2. `npx cap add android`, portret + VIBRATE dozvola, `cap sync`
3. `gradlew assembleDebug` potpisan fiksnim `keystore/debug.keystore`

APK skidaš iz **Actions → zadnji run → Artifacts → `tail-survivors-apk`**, ili iz **Releases**.
Grane osim `main` grade "Dev" verziju (drugi appId, instalira se pored originala).
`debug.keystore` je fiksni DEBUG ključ (nove verzije se instaliraju preko starih). Za Google Play treba poseban release keystore.

## Gdje su postavke i šta je u kojem fajlu (`www/`)

| Fajl | Šta radi |
|---|---|
| `strings.js` | **Svi tekstovi igre** (jedan fajl, za prevod) |
| `data.js` | Oružja (statistike po levelu), neprijatelji, bossovi, trajne nadogradnje, trajanje runde, veličina arene |
| `game.js` | Simulacija bez DOM-a: zmija, oružja, neprijatelji, boss, level-up, spawn (pool objekata, bez alokacija u petlji) |
| `main.js` | Ekrani (meni, igra, level-up, pauza, game over, shop, settings), unos dodirom, crtanje, petlja |
| `sprites.js` | Sva grafika crtana kodom u offscreen canvase |
| `audio.js` | Efekti i muzika (WebAudio), prekidači muzika/efekti + vibracija |
| `storage.js` | Lokalni save (`localStorage`): coini, najbolji rezultat/vrijeme/level, postavke, trajne nadogradnje |
| `ads.js` | **AdService**: jedini modul koji zna za reklame (trenutno simulacija) |

Postavke zvuka i vibracije su u igri: Menu → Settings (ili Pause). Spremaju se lokalno.

## Rewarded video (AdService)

Monetizacija je samo rewarded video: Reroll izbora na level-upu, Revive, Double coins, +60 coina u shopu.
Nema banera ni prisilnih reklama. Sada `www/ads.js` **simulira** reklamu: tap → odbrojavanje 3 s na dugmetu → nagrada → cooldown 20 s.

Kad dođe pravi AdMob, zamijeni samo unutrašnjost `ads.js`, zadrži API:

```js
AdService.status(placement)        // -> { state: 'idle' | 'watching' | 'cooldown', t: sekundi }
AdService.show(placement, onReward) // pokreće reklamu, poziva onReward nakon gledanja
AdService.update(dt)                // zove UI svaki frame
```

Placementi: `reroll`, `revive`, `double`, `bonus`.

## Kontrole i mehanike

- Prst na ekranu = smjer glave (plutajući joystick, zmija se kreće stalno i glatko).
- Neprijatelj koji dotakne glavu rani glavu (0 HP = kraj); koji dotakne rep rani taj segment, na 0 HP se segment odvaja.
- Level-up: 1 od 3 izbora: novi segment s oružjem, nadogradnja segmenta (do Lv 5) ili zamjena mjesta dva segmenta.
- Oružja (6): Spike (udar okolo), Blaster (puca), Toxin (otrovne lokve na tragu), Aegis (štit/odguruje), Arc (munja), Mortar (bombe na tragu).
- Hrana na polju liječi, XP kristali daju level. Coini se dobijaju na kraju runde i troše na trajne bonuse (Upgrades).
