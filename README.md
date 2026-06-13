# PlayFab emulator for OVERKILL's The Walking Dead
OTWD used PlayFab for weekly quests/NPCs and bounties but that PlayFab title has since stopped operating, this serves to replicate the functionality provided for it.

Unfortunately a minimal amount of user data must be stored in order to mark whether or not they've done the quest.
All this stores is your current weekly quest progress alongside a SHA256 hashed version of your Steam ID.
This data is deleted weekly, as is the quest, if you wish to delete your data before then you can go to the URL of the hosted instance (e.g. https://otwd.hw12.dev), paste your Steam ID into the text input and click "Reset weekly state"

## Connecting
To connect to an instance, open `%localappdata%\OTWD\Saved\Config\WindowsNoEditor\Engine.ini` and add
```ini
[/Script/PlayFab.PlayFabRuntimeSettings]
TitleId=
ProductionEnvironmentURL=InstanceURL
```
to the end.

For example, to connect to the instance I host (https://otwd.hw12.dev), you would add
```ini
[/Script/PlayFab.PlayFabRuntimeSettings]
TitleId=
ProductionEnvironmentURL=otwd.hw12.dev
```
to the end.

## Running

For testing:
 - Setup a [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) for port 3000 on localhost
 - Open `%localappdata%\OTWD\Saved\Config\WindowsNoEditor\Engine.ini`
 - Add the following:
```ini
[/Script/PlayFab.PlayFabRuntimeSettings]
TitleId=
ProductionEnvironmentURL={CloudflareTunnelUrl}
```

This project is setup to host with Docker Compose and Cloudflare tunnels, if you wish to host an instance copy `.env.example` to `.env`, setup your Cloudflare tunnel token, and add a route with the service URL `http://otwdplayfab-emulator:3000`
