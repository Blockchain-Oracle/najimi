import assert from "node:assert/strict"
import { test } from "node:test"
import { linksInPage } from "./page-links"

test("a homepage's socials come from its links, skipping share and post URLs", () => {
  const html = `
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <a href="https://www.instagram.com/p/abc123/">a post</a>
    <a href="https://www.instagram.com/dishoom/">Instagram</a>
    <a href="https://www.tiktok.com/@dishoom_uk">TikTok</a>
    <a href="https://twitter.com/intent/tweet?url=x">share</a>
    <a href="https://x.com/Dishoom">X</a>
    <a href="https://www.youtube.com/user/DishoomLondon">YouTube</a>`
  const links = linksInPage(html, "https://www.dishoom.com/shoreditch")
  assert.equal(links.instagram, "dishoom")
  assert.equal(links.tiktok, "dishoom_uk")
  assert.equal(links.x, "Dishoom")
  assert.equal(links.youtube, "user/DishoomLondon")
  assert.equal(links.logo, "https://www.dishoom.com/apple-touch-icon.png")
})

test("without an icon, the logo falls back to the site's favicon", () => {
  const links = linksInPage("<html></html>", "http://www.nokbyalara.com/")
  assert.equal(links.instagram, null)
  assert.match(links.logo ?? "", /s2\/favicons\?domain=www\.nokbyalara\.com/)
})
