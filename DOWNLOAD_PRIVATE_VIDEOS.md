# Download Twitch Private Videos (Sub Only or Hidden)

## Step 1

Go to one of these websites.

```bash
https://twitchtracker.com/%channel_name%/streams

https://streamscharts.com/channels/%channel_name%/streams

# examples
https://twitchtracker.com/xqc/streams
https://streamscharts.com/channels/lirik/streams
```

## Step 2

Find the VOD that you want to download.

> [!NOTE]  
> If the VOD is older than 2 month, chances of downloading such a VOD are close to 0.

```bash
# examples
https://twitchtracker.com/xqc/streams/51582913581
https://streamscharts.com/channels/lirik/streams/51579711693
```

## Step 3

Open the Developer Tools in your browser (press `F12` or `Ctrl+Shift+I` or Right Click -> Inspect)

Switch to the Console tab.

Copy and paste this code to the console.

```js
let startDate, startTimestamp, videoId, channelLogin;
if (location.hostname === 'twitchtracker.com') {
  startDate = document.querySelector('meta[name="description"]').content.match(/\w+ stream on (.+) -/)[1] + '+00:00';
  [, channelLogin, , videoId] = location.pathname.split('/');
}
if (location.hostname === 'streamscharts.com') {
  startDate = JSON.parse(document.querySelector('[x-data="twitchClipsBlock()"]').dataset.requests)[0].started_at;
  [, , channelLogin, , videoId] = location.pathname.split('/');
}
startTimestamp = new Date(startDate).getTime() / 1000;
`video:${channelLogin}_${videoId}_${startTimestamp}`;
```

Press `Enter`.

Example:

![twitchtracker console](images/twitchtracker-console.png)

## Step 4

Use the result from the previous step to download the VOD with [twitch-dlp](https://github.com/DmitryScaletta/twitch-dlp).

```bash
npx twitch-dlp video:%channel_login%_%video_id%_%start_timestamp%

# examples
npx twitch-dlp video:xqc_51582913581_1721686515
npx twitch-dlp video:lirik_51579711693_1721664413
```

## FAQ

Q: Is it automatable?  
A: Unfortunately no. Both twitchtracker.com and streamscharts.com are using anti DDOS protection, so it's not easy to retrieve the HTML content of these pages.

Q: Can you add support for sullygnome.com?  
A: It's not possible because they don't show seconds (only hours and minutes) when the stream started.
