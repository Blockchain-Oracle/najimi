import assert from "node:assert/strict"
import { test } from "node:test"
import {
  channelName,
  instagramContents,
  soundName,
  spotifyContents,
  tiktokContents,
  xContents,
  youtubeContents,
} from "./exports"

test("x: liked words from the archive's script files; follows counted", () => {
  const c = xContents({
    "data/following.js": `window.YTD.following.part0 = [
      { "following": { "accountId": "18969923", "userLink": "https://twitter.com/intent/user?user_id=18969923" } },
      { "following": { "accountId": "not-an-id" } }
    ]`,
    "data/like.js": `window.YTD.like.part0 = [
      { "like": { "tweetId": "1", "fullText": "Finally watched Shōgun &amp; loved it https://t.co/abc" } },
      { "like": { "tweetId": "2", "fullText": "ok" } }
    ]`,
  })
  assert.equal(c.counts.following, 2)
  assert.deepEqual(c.texts, ["Finally watched Shōgun & loved it"])
})

test("instagram: following in title or value, likes in old and new shapes, ranked", () => {
  const c = instagramContents({
    "connections/followers_and_following/following.json": JSON.stringify({
      relationships_following: [
        {
          title: "burnaboy",
          string_list_data: [{ href: "https://www.instagram.com/_u/burnaboy" }],
        },
        { string_list_data: [{ value: "Nike" }] },
      ],
    }),
    "your_instagram_activity/likes/liked_posts.json": JSON.stringify([
      {
        label_values: [
          { label: "URL", value: "https://www.instagram.com/reel/X/" },
          { title: "Owner", dict: [{ dict: [{ label: "Username", value: "nike" }] }] },
        ],
      },
      {
        label_values: [
          { title: "Owner", dict: [{ dict: [{ label: "Username", value: "temsbaby" }] }] },
        ],
      },
    ]),
  })
  assert.deepEqual(
    c.candidates.map((x) => x.external?.id),
    ["nike", "burnaboy", "temsbaby"],
  )
})

test("tiktok: following and sounds wherever the version keeps them; videos only counted", () => {
  const c = tiktokContents({
    "user_data_tiktok.json": JSON.stringify({
      "Your Activity": {
        Following: { Following: [{ UserName: "Davido" }, { UserName: "bad name!" }] },
        "Watch History": {
          VideoList: [
            { Date: "2026-08-05 08:36:26", Link: "https://www.tiktokv.com/share/video/1/" },
          ],
        },
      },
      "Likes and Favorites": {
        "Favorite Sounds": {
          FavoriteSoundList: [
            { Link: "https://www.tiktok.com/music/Essence-feat-Tems-6948034321853238022" },
          ],
        },
        "Favorite Videos": { FavoriteVideoList: null },
      },
    }),
  })
  assert.deepEqual(
    c.candidates.map((x) => x.name),
    ["davido"],
  )
  assert.deepEqual(c.texts, ["A favourite TikTok sound: Essence feat Tems"])
  assert.equal(c.counts.watched, 1)
  assert.equal(c.counts.favourites, 0)
})

test("tiktok: the older Activity / Following List shape", () => {
  const c = tiktokContents({
    "user_data.json": JSON.stringify({
      Activity: { "Following List": { Following: [{ UserName: "wizkid" }] } },
    }),
  })
  assert.deepEqual(
    c.candidates.map((x) => x.name),
    ["wizkid"],
  )
})

test("tiktok: a sound's name from its link; original sounds are skipped", () => {
  assert.equal(
    soundName("https://www.tiktok.com/music/Last-Last-7096153129474558725?lang=en"),
    "Last Last",
  )
  assert.equal(soundName("https://www.tiktok.com/music/original-sound-7012345678901234567"), null)
})

test("spotify: library artists first, then the artists behind saved tracks, and shows", () => {
  const c = spotifyContents({
    "Spotify Account Data/YourLibrary.json.json": JSON.stringify({
      tracks: [{ artist: "Rema" }, { artist: "Rema" }, { artist: "Tems" }],
      artists: [{ name: "Tems" }],
      shows: [{ name: "Song Exploder" }],
    }),
  })
  assert.deepEqual(
    c.candidates.map((x) => [x.name, x.type]),
    [
      ["Tems", "urn:entity:artist"],
      ["Rema", "urn:entity:artist"],
      ["Song Exploder", "urn:entity:podcast"],
    ],
  )
})

test("youtube: artists played most, then subscriptions; other watched channels only as titles", () => {
  const watch = (header: string, channel: string, title: string) => ({
    header,
    title,
    titleUrl: "https://www.youtube.com/watch?v=x",
    subtitles: [{ name: channel }],
  })
  const c = youtubeContents({
    "Takeout/YouTube und YouTube Music/Verlauf/watch-history.json": JSON.stringify([
      watch("YouTube Music", "Tems - Topic", "Watched Free Mind"),
      watch("YouTube Music", "Tems - Topic", "Watched Me & U"),
      watch("YouTube", "Colors", "Watched A COLORS SHOW"),
      { header: "YouTube", title: "Watched a video that has been removed" },
    ]),
    "subscriptions.csv":
      'Kanal-ID,Kanal-URL,Kanaltitel\nUC1,http://x,"Colors, A Show"\nUC2,http://y,GeniusVEVO\n',
  })
  assert.deepEqual(
    c.candidates.map((x) => [x.name, x.type]),
    [
      ["Tems", "urn:entity:artist"],
      ["Colors, A Show", null],
      ["Genius", null],
    ],
  )
  assert.equal(c.texts[0], "Free Mind (Tems)")
  assert.equal(c.counts.watched, 3)
})

test("youtube: channel names lose Topic and VEVO", () => {
  assert.equal(channelName("Burna Boy - Topic"), "Burna Boy")
  assert.equal(channelName("BurnaBoyVEVO"), "BurnaBoy")
})
