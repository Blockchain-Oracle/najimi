import assert from "node:assert/strict"
import { test } from "node:test"
import { artistsIn, candidatesFrom } from "./reads"

test("followed accounts become handles; liked posts add their owners and songs", () => {
  const out = candidatesFrom({
    platform: "instagram",
    following: [
      { username: "Wizkidayo", name: "Wizkid" },
      { username: "not a handle!", name: "Nope" },
    ],
    posts: [
      { owner: "wizkidayo", music: { artist: "Tems, Wizkid" } },
      { owner: "fela.kuti", ownerName: "Fela", music: null },
    ],
  })
  assert.deepEqual(
    out.map((c) => (c.external ? `${c.external.kind}:${c.external.id}` : `${c.type}:${c.name}`)),
    [
      "instagram:wizkidayo",
      "urn:entity:artist:Tems",
      "urn:entity:artist:Wizkid",
      "instagram:fela.kuti",
    ],
  )
})

test("x handles match on Qloo's twitter ids; tiktok has no handle ids", () => {
  assert.equal(
    candidatesFrom({ platform: "x", following: [{ username: "@Rihanna" }] })[0]?.external?.kind,
    "twitter",
  )
  assert.equal(
    candidatesFrom({ platform: "tiktok", following: [{ username: "rihanna" }] }).length,
    0,
  )
})

test("credits split into artists", () => {
  assert.deepEqual(artistsIn("Burna Boy ft. Ed Sheeran"), ["Burna Boy", "Ed Sheeran"])
  assert.deepEqual(artistsIn("Simon & Garfunkel x Someone"), ["Simon", "Garfunkel"])
  assert.deepEqual(artistsIn("Asake"), ["Asake"])
})
