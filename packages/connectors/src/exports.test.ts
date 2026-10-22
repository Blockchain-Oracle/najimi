import assert from "node:assert/strict"
import { test } from "node:test"
import {
  instagramCandidates,
  spotifyCandidates,
  tiktokCandidates,
  youtubeCandidates,
} from "./exports"

test("instagram: followed accounts rank above liked ones", () => {
  const c = instagramCandidates({
    "connections/followers_and_following/following.json": JSON.stringify({
      relationships_following: [
        { string_list_data: [{ value: "burnaboy" }] },
        { string_list_data: [{ value: "Nike" }] },
      ],
    }),
    "your_instagram_activity/likes/liked_posts.json": JSON.stringify({
      likes_media_likes: [{ title: "temsbaby" }, { title: "nike" }],
    }),
  })
  assert.deepEqual(
    c.map((x) => x.external?.id),
    ["nike", "burnaboy", "temsbaby"],
  )
})

test("tiktok: the following list", () => {
  const c = tiktokCandidates({
    "user_data.json": JSON.stringify({
      Activity: {
        "Following List": { Following: [{ UserName: "Davido" }, { UserName: "bad name!" }] },
      },
    }),
  })
  assert.deepEqual(
    c.map((x) => x.name),
    ["davido"],
  )
})

test("spotify: library artists and shows", () => {
  const c = spotifyCandidates({
    "YourLibrary.json": JSON.stringify({
      artists: [{ name: "Tems" }],
      shows: [{ name: "Song Exploder" }],
    }),
  })
  assert.deepEqual(
    c.map((x) => [x.name, x.type]),
    [
      ["Tems", "urn:entity:artist"],
      ["Song Exploder", "urn:entity:podcast"],
    ],
  )
})

test("youtube: channel titles from Takeout's CSV, quoted commas kept", () => {
  const c = youtubeCandidates({
    "subscriptions.csv":
      'Channel Id,Channel Url,Channel Title\nUC1,http://x,"Colors, A Show"\nUC2,http://y,Genius\n',
  })
  assert.deepEqual(
    c.map((x) => x.name),
    ["Colors, A Show", "Genius"],
  )
})
