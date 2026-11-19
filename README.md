# Solmar Bay — an open-world crime story

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/888chunfeng168/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/888chunfeng168/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game set in Solmar Bay: drive, steal cars, dodge the police and run jobs. Built by an AI agent for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).

Rio just rolled into a sun-soaked coastal city with $50 and a borrowed pistol. Delia Voss has jobs. The Solmar Bay PD has other ideas.

## The game

- **Open world on foot and by car** — a full city grid with roads, sidewalks, parks, a beach and the sea, all procedural and drawn in canvas.
- **Traffic and pedestrians** — cars follow the road grid, people stroll the sidewalks and scatter when shots are fired.
- **Cars to steal** — parked cars and traffic are yours for the taking (press E). Stealing one calls the cops.
- **Wanted level** — 0–5 stars for car theft, running people over, shooting civilians or cops. PD interceptors chase and ram; foot cops try to arrest you. Break line of sight and the heat cools off.
- **4 story missions** — a delivery, losing the heat, a timed getaway with a passenger, and a bank robbery with a 3-star escape. Cash rewards, waypoint beacons, timers.
- **Combat** — mouse aim, click to shoot (limited ammo), Space to punch on foot or handbrake while driving.
- **HUD** — health, money, wanted stars, objective line, speedometer, and a live minimap with the waypoint, cops and traffic.
- **Progression & save** — money, ammo and mission progress save to localStorage.
- **Sound** — engine hum, two-tone sirens, gunshots and cash chimes, all synthesized with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| E | Enter / steal car, exit car |
| Mouse + click | Aim and shoot (pistol) |
| Space | Punch on foot / handbrake while driving |
| Shift | Sprint |
| M | Start the next story job |
| Esc | Pause |

## Run it

```bash
node serve.ts
# open http://localhost:8080
```

Build the submission bundle (copies `game/` + `screenshots/` and writes `dossier.json`):

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

No build step, no network: every file the game loads lives under `game/`.

## Screenshots

`1-chase.jpg` is the cover: a 3-star police chase mid-getaway with the wanted level, minimap and mission objective on the HUD. The other three show the city on foot, driving in traffic, and a mission in progress.

## License

MIT — see [LICENSE](LICENSE).
