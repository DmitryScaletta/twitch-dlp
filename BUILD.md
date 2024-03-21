# Single executable

"%(id)s [%(release_date)s] %(title)s.%(ext)s"

## windows

```bash
# 3
node --experimental-sea-config sea-config.json
# 4
node -e "require('fs').copyFileSync(process.execPath, 'twitch-dlp.exe')"
# 5
signtool remove /s twitch-dlp.exe
# 6
npx postject twitch-dlp.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
# 7
signtool sign /fd SHA256 twitch-dlp.exe
```

## macos

```bash
# 3
node --experimental-sea-config sea-config.json
# 4
cp $(command -v node) twitch-dlp
# 5
codesign --remove-signature twitch-dlp
# 6
npx postject twitch-dlp NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA
# 7
codesign --sign - twitch-dlp
```

## linux

```bash
# 3
node --experimental-sea-config sea-config.json
# 4
cp $(command -v node) twitch-dlp
# 5
# skip
# 6
npx postject twitch-dlp NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
# 7 skip
```


## Bugs

Fix case if cannot get formats list
Wrong format

Fix more than 100%
[download] 114.3% of ~      44MB at     670kB/s ETA 23:59:50 (frag 7/7)

Fix ETA. negative values?
ETA 23:59:49
