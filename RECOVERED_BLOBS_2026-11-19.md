# cube1 Blob rescue checkpoint — 2026-11-19

## Confirmed rescued and committed
12 original binary blobs (two PNG icons + ten WAV files) were successfully referenced by SHA in a new Git tree, committed to `rescue/2026-11-19-audit`, and verified through GitHub's recursive tree endpoint.

Recovery commit: `78909ead5c63b3c75c08007d7ab3b81036e16f9a`

| File | Git Blob SHA | Bytes |
| --- | --- | ---: |
| dist/assets/icon-192.png | 81d66a46b14e42a00422fc6f8b46f73f971a5cc8 | 16922 |
| dist/assets/icon-512.png | ae664f67ae6e9fe32c182a3b1a4a04983a1ea140 | 45793 |
| dist/games/spinrealm/audio/clear.wav | aa9b40c9364eed332b338bafd7617d4fedaac9c4 | 26314 |
| dist/games/spinrealm/audio/drop.wav | 4173744e8cd03d7534e0971917ad4849ea899066 | 17348 |
| dist/games/spinrealm/audio/hold.wav | 907df75c4d93720c143bdcd766acc0930ec27452 | 44850 |
| dist/games/spinrealm/audio/incoming.wav | e596e4274a1c0d84822b7503c0dc38c985fe3492 | 44028 |
| dist/games/spinrealm/audio/item.wav | d8112824db75bf19a7e8beb09a3792188f2b9fa1 | 37614 |
| dist/games/spinrealm/audio/move.wav | d99725539a4072ea0590fa4435336a1cafd37a65 | 4718 |
| dist/games/spinrealm/audio/over.wav | ce1557f34b6b741a38548abf9c1d0b91da1098e4 | 44598 |
| dist/games/spinrealm/audio/rotate.wav | 75ceb26c97a991324651180618fa5b7a3d5ca207 | 1774 |
| dist/games/spinrealm/audio/spin.wav | 5e2424c26b3b0b2a555af7cd3f0eeb86d2817d99 | 44004 |
| dist/games/spinrealm/audio/win.wav | 4af23dfc5e7664213e1ed637faf6a663148eae02 | 48290 |

## Missing, per GitHub blob lookup (404)
- dist/games/spinrealm/audio/music-loop.mp3: `d9543e869d3aaacf1a5bd8834ee80bd2d6ecabf6` (2,151,400 bytes)
- docs/steam/SnowRealmGames_Steam_Guide_zh-CN.pdf: `d29a3f4784bf6cd69e790d83af1274f56044f27a` (335,798 bytes)

These were reported as content-derived Git blob hashes in the older recovery log; 404 is not evidence that the original files have been deleted from every other environment.

## Remaining
- 125 UTF-8 source/document files have not been retrieved or verified.
- Do not misrepresent the 12 binary recovered assets as a complete runnable game.
- `main` was not changed.
- Original staging path: `/workspace/repos/cube1`; manifest path: `/workspace/repos/cube1-manifest.json`; historical SHA-256 `0d3655bd036eb14760176fc5f188c25897960f47e9c5ea71fa38639803be247e`.
- Historical existing Site checkout: `/workspace/sites/snowrealm-games`; the separate ephemeral workspace is not mounted here.
- Next: retrieve exported JSON/old payload `/workspace/scratch/d097d68335da/cube1-upload-payload.json` or original staging ZIP and reconstitute 125 UTF-8 files, then retest.
