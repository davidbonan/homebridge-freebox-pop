# homebridge-freebox-pop

Homebridge plugin that exposes one HomeKit switch per TV channel for a **Freebox Pop player**. Turning a switch on wakes the player and tunes it to that channel, so a HomeKit automation can say "at 8 pm, put TF1 on".

It is built to be left alone: the connection to the player is kept alive and repaired in the background, and every command is retried until it is confirmed.

> **Status: prototype.** Tested against a simulated player only. Two points still need a real Freebox Pop to confirm, see [Not yet validated](#not-yet-validated).

## What a switch does

When a channel switch is turned on:

1. Wait for the connection to the player (it reconnects on its own).
2. If the player is asleep, press Power and wait until it reports being awake.
3. Open the channel in OQEE through its link, `https://oq.ee/channel/<id>/play`.
4. Check that OQEE is the app on screen.

If any step fails, the whole sequence is retried, up to 4 attempts with a growing pause. The switch turns itself back off when the sequence ends, whether it succeeded or gave up. The outcome is written to the Homebridge log.

Turning on another channel while one is in progress cancels the first. Turning a switch off cancels its sequence.

## Requirements

- Homebridge 1.8 or 2.x, Node.js 22.18 or newer.
- A Freebox Pop player (Android TV) on the same network as Homebridge.
- **A static DHCP lease** for the player, so its address never changes.
- **Light standby** ("veille légère") on the player. In deep standby the player leaves the network and nothing can wake it.
- HDMI-CEC enabled on the player if you want the TV itself to turn on with it.

## Install

The plugin is not on npm yet. Build a package and install it by hand:

```sh
git clone https://github.com/davidbonan/homebridge-freebox-pop.git
cd homebridge-freebox-pop
npm install
npm pack                      # produces homebridge-freebox-pop-0.1.0.tgz
```

Copy the `.tgz` to the Homebridge machine, then, from the Homebridge storage folder (`/var/lib/homebridge` on the official Raspberry Pi image):

```sh
npm install /path/to/homebridge-freebox-pop-0.1.0.tgz
```

## Pair with the player

Pairing is done once. With the TV on, run on the Homebridge machine:

```sh
npx freebox-pop-pair <player-ip>
```

The TV shows a 6-character code; type it in the terminal. The pairing is saved to `freebox-pop-credentials.json` in the Homebridge storage folder. If your storage folder is not `/var/lib/homebridge`, pass it as a second argument.

## Configure

Add the platform to the Homebridge `config.json` (or use the settings form in the Homebridge UI), then restart Homebridge:

```json
{
  "platform": "FreeboxPop",
  "host": "192.168.1.50",
  "channels": [
    { "name": "TF1", "oqeeChannelId": 536 },
    { "name": "France 2", "oqeeChannelId": 270 },
    { "name": "M6", "oqeeChannelId": 537 },
    { "name": "Arte", "oqeeChannelId": 273 }
  ]
}
```

| Field | Meaning |
|---|---|
| `host` | IP address or hostname of the player. |
| `channels[].name` | Name of the switch in HomeKit. |
| `channels[].oqeeChannelId` | OQEE's id for the channel. This is **not** the channel number on the remote. |

### Finding a channel id

OQEE publishes its channel list. This prints `id` and name for every channel:

```sh
curl -s https://api.oqee.net/api/v6/service_plan \
  | jq -r '.result.channels[] | "\(.id)\t\(.name)"'
```

## Troubleshooting

All messages are in the Homebridge log, prefixed with `[FreeboxPop]`.

| Log message | Meaning |
|---|---|
| `No pairing found in …` | Run `freebox-pop-pair`, then restart Homebridge. |
| `Player … connection lost, reconnecting` | Normal when the player sleeps deeply or reboots. Reconnection is automatic. |
| `attempt N failed, retrying` + `player unreachable` | The player is off the network: check standby mode and the IP address. |
| `gave up` + `OQEE did not come to the foreground` | The link was sent but OQEE did not open. |

## Not yet validated

Both come from documentation and other people's reports, not from a test on a real player:

- **The channel link.** `https://oq.ee/channel/<id>/play` is the format discussed in [Freebox bug 37971](https://dev.freebox.fr/bugs/task/37971), reported fixed by Free in April 2023.
- **The on-screen app report.** Step 4 relies on the player announcing which app is in the foreground.

Known limit: the plugin can confirm that OQEE is on screen, not which channel is playing.

## Development

```sh
npm test            # unit tests
npm run typecheck
npm run build       # compiles to dist/
```

The code is organised by feature, then by layer:

```
src/channels/watching/
  domain/          Player contract, OQEE link
  application/     watchChannel: the retried sequence
  infrastructure/  Android TV Remote session (TLS, reconnection)
  ui/              Homebridge platform and switches
src/player/        pairing CLI and stored credentials
```

Message encoding and pairing come from [`androidtv-remote`](https://github.com/louis49/androidtv-remote). The connection itself is handled here, because that library stops reconnecting once the player becomes unreachable.

## License

ISC
