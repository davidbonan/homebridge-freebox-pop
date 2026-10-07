# homebridge-freebox-pop

Homebridge plugin for a **Freebox Pop player**. It exposes one HomeKit switch per TV channel, one power switch, and a television that the iPhone remote can drive. Turning a channel switch on wakes the player and tunes it to that channel, so a HomeKit automation can say "at 8 pm, put TF1 on"; turning the power switch off puts the player to sleep.

It is built to be left alone: the connection to the player is kept alive and repaired in the background, and every command is retried until it is confirmed.

> **Status: prototype.** Pairing, network search, channel switching, the power switch and the iPhone remote are confirmed on a real Freebox Pop. See [Not yet validated](#not-yet-validated) for what is left.

## What the switches do

### Channel switches

When a channel switch is turned on:

1. Wait for the connection to the player (it reconnects on its own).
2. If the player is asleep, press Power and wait until it reports being awake.
3. Open the channel in OQEE through its link, `https://oq.ee/channel/<id>/play`.
4. Check that OQEE is the app on screen.
5. If the player woke less than 13 seconds ago, whoever woke it, open the channel again 10 seconds later: OQEE coming out of standby returns to its last channel and can drop the first link.

If any step fails, the whole sequence is retried, up to 4 attempts with a growing pause. The switch turns itself back off when the sequence ends, whether it succeeded or gave up. The outcome is written to the Homebridge log.

Turning a channel switch off cancels the sequence of that channel, and nothing else.

### Power switch

A switch named **Freebox Player** follows the player: on when it is awake, off when it sleeps.

- Turning it **off** puts the player to sleep. With HDMI-CEC enabled, the TV turns off with it.
- Turning it **on** wakes the player without changing what is on screen.

Power is a toggle key on the remote, so the plugin only presses it when the player is not already in the requested state. The same retries apply.

Only one command runs at a time: a new one, from any switch, cancels the one in progress. A Power press already sent is seen through first, so that a scene turning the player on and picking a channel presses Power once.

### Television and iPhone remote

A television named **Freebox Pop** makes the player show up in the iPhone's Control Center remote.

- Arrows, select, back, play/pause and info are sent to the player as remote keys.
- The iPhone's volume buttons send volume up and down while the remote is open.
- Each configured channel is an input of the television; picking one tunes to it like its switch does.
- Its power button behaves like the power switch.

A key is sent once and not retried: if the player is unreachable, the press is dropped and logged.

HomeKit only accepts a television outside the bridge, so it has to be added once by hand: in the Home app, **Add Accessory** → **More options**, pick **Freebox Pop**, and enter the Homebridge PIN.

## Requirements

- Homebridge 1.8 or 2.x, Node.js 22.18 or newer.
- A Freebox Pop player (Android TV) on the same network as Homebridge.
- **A static DHCP lease** for the player, so its address never changes.
- **Light standby** ("veille légère") on the player. In deep standby the player leaves the network and nothing can wake it.
- HDMI-CEC enabled on the player if you want the TV itself to turn on with it.

## Install

In the Homebridge UI, open **Plugins**, search for `homebridge-freebox-pop` and install it.

From a terminal, in the Homebridge storage folder (`/var/lib/homebridge` on the official Raspberry Pi image):

```sh
npm install homebridge-freebox-pop
```

## Set up in the Homebridge UI

Open the plugin settings in the Homebridge UI. Everything is done from that screen.

**1. Pair with the player** (once, with the TV on)

1. Click **Search the network** and pick your player in the list. If it is not found, type its IP address.
2. Click **Pair**. The TV shows a 6-character code.
3. Type the code and click **Confirm**. The screen now reads "Paired with …".

A wrong code ends the attempt: click **Pair** again to get a new one. The pairing (player address and keys) is stored in `freebox-pop-player.json` in the Homebridge storage folder, not in `config.json`.

**2. Add your channels**

Under **Channels**, add one entry per channel, then **Save** and restart Homebridge.

| Field | Meaning |
|---|---|
| Switch name | Name of the switch in HomeKit. |
| OQEE channel id | OQEE's id for the channel. This is **not** the channel number on the remote. |

The resulting `config.json` block:

```json
{
  "platform": "FreeboxPop",
  "channels": [
    { "name": "TF1", "oqeeChannelId": 536 },
    { "name": "France 2", "oqeeChannelId": 270 },
    { "name": "M6", "oqeeChannelId": 537 },
    { "name": "Arte", "oqeeChannelId": 273 }
  ]
}
```

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
| `Not paired with a player yet` | Pair from the plugin settings, then restart Homebridge. |
| `Player … connection lost, reconnecting` | Normal when the player sleeps deeply or reboots. Reconnection is automatic. |
| `attempt N failed, retrying` + `player unreachable` | The player is off the network: check standby mode and the IP address. |
| `gave up` + `OQEE did not come to the foreground` | The link was sent but OQEE did not open. |

## Not yet validated

- **The television's volume buttons and inputs.** The remote drives the player, but these two have not been checked one by one.

Confirmed on a real player: the channel link `https://oq.ee/channel/<id>/play` (the format from [Freebox bug 37971](https://dev.freebox.fr/bugs/task/37971)), the on-screen app report, the network search, the power switch in both directions, waking after a night in light standby, and the television in the iPhone remote.

## Limitations

- **One player only.** The plugin drives a single Freebox Pop player. The network search lists every player in the house, but pairing a second one replaces the first, and all channel switches target the paired player.
- **The channel itself is not verified.** The plugin can confirm that OQEE is on screen, not which channel is playing.
- **Deep standby cannot be woken.** A player in deep standby is off the network; use light standby.

## Development

```sh
npm test            # unit tests
npm run typecheck
npm run build       # compiles to dist/
```

The code is organised by feature, then by layer:

```
src/freeboxPopPlatform.ts   Homebridge platform: the HomeKit switches
src/freeboxPopTelevision.ts HomeKit television: power, inputs, remote keys
src/channels/watching/
  domain/                   OQEE link
  application/              watchChannel: wake, open the channel, check
src/player/
  connection/               Player contract, retries, one command at a time, Android TV Remote session
  power/                    wake and sleep, turnPlayerOn / turnPlayerOff
  discovery/                mDNS search for players
  pairing/                  pairing with a player
  settingsUi/               settings screen shown in the Homebridge UI
  pairedPlayerFile.ts
```

The plugin speaks the Android TV Remote protocol itself: the TLS session, its reconnection, pairing and the client certificate are all in `src/player`. The message definitions are a subset of those published by [`androidtv-remote`](https://github.com/louis49/androidtv-remote) (MIT).

## License

ISC
