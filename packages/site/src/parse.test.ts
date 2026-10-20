import assert from "node:assert/strict"
import { test } from "node:test"
import { jsonLdFacts, socialHandles, wikidataId } from "./parse"

test("social handles from links, skipping platform pages", () => {
  const html = `
    <a href="https://www.instagram.com/p/abc123/">post</a>
    <a href="https://www.instagram.com/barbrutal/">ig</a>
    <a href="https://x.com/intent/tweet?text=hi">share</a>
    <a href="https://twitter.com/BarBrutal">tw</a>
    <a href="https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4">spotify</a>`
  assert.deepEqual(socialHandles(html), {
    instagram: "barbrutal",
    twitter: "BarBrutal",
    spotify: "3TVXtAsR1Inumwj472S9r4",
  })
})

test("JSON-LD business facts, @graph included", () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
    {"@type":"WebSite","name":"site"},
    {"@type":["Restaurant","LocalBusiness"],"name":"Bar Brutal","telephone":"+34 930 000 000",
     "address":{"@type":"PostalAddress","streetAddress":"Carrer de la Barra de Ferro 1","addressLocality":"Barcelona","addressCountry":"ES"},
     "geo":{"@type":"GeoCoordinates","latitude":"41.3851","longitude":2.1834},
     "servesCuisine":["Catalan","Natural wine"],
     "sameAs":["https://www.wikidata.org/wiki/Q123456","https://instagram.com/barbrutal"]}]}</script>`
  const facts = jsonLdFacts(html)
  assert.deepEqual(facts.types, ["Restaurant", "LocalBusiness"])
  assert.equal(facts.name, "Bar Brutal")
  assert.equal(facts.city, "Barcelona")
  assert.equal(facts.country, "ES")
  assert.equal(facts.lat, 41.3851)
  assert.equal(facts.lon, 2.1834)
  assert.deepEqual(facts.cuisine, ["Catalan", "Natural wine"])
  assert.equal(wikidataId(facts.sameAs), "Q123456")
})

test("broken JSON-LD is skipped, not fatal", () => {
  assert.deepEqual(jsonLdFacts(`<script type="application/ld+json">{oops</script>`).types, [])
})

import { htmlToText, metaContent, sameSiteLinks } from "./direct"

test("direct reading: text, meta and same-site links", () => {
  const html = `<html lang="pt-BR"><head><meta property="og:site_name" content="Bar &amp; Cozinha"></head>
  <body><script>x()</script><h1>Menu</h1><ul><li>Moqueca</li><li>Feijoada</li></ul>
  <a href="/sobre">Sobre</a><a href="https://other.com/x">x</a><a href="/menu#top">m</a></body></html>`
  assert.equal(metaContent(html, "og:site_name"), "Bar & Cozinha")
  assert.match(htmlToText(html), /# Menu\n+- Moqueca\n- Feijoada/)
  assert.deepEqual(sameSiteLinks(html, "https://barcozinha.com.br"), [
    "https://barcozinha.com.br/sobre",
    "https://barcozinha.com.br/menu",
  ])
})
