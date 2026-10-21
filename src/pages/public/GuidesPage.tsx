import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'

const SECTIONS = [
  { id: 'concentrations', title: 'Concentrations' },
  { id: 'pyramid', title: 'The note pyramid' },
  { id: 'families', title: 'Families and accords' },
  { id: 'performance', title: 'Performance terms' },
  { id: 'philippines', title: 'Wearing scent in Philippine weather' },
  { id: 'storage', title: 'Storing bottles in tropical heat' },
  { id: 'buying', title: 'Testing and buying' },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line pt-8">
      <h2 id={`${id}-h`} className="text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-ink-2 [&_strong]:font-medium [&_strong]:text-ink">
        {children}
      </div>
    </section>
  )
}

const CONCENTRATION_ROWS = [
  ['Body mist', '1–3%', '1–2 hours', 'Splash-like; easy to reapply'],
  ['Eau de Cologne', '2–5%', '2 hours or less', 'Bright, brisk, made for hot days'],
  ['Eau de Toilette (EDT)', '5–15%', '3–5 hours', 'Lighter, airier opening'],
  ['Eau de Parfum (EDP)', '15–20%', '5–8 hours', 'Fuller, usually softer projection after the opening'],
  ['Parfum / Extrait', '20–40%', '8 hours or more', 'Dense, close to the skin, long lasting'],
]

export default function GuidesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Guides"
        title="Fragrance basics"
        description="Plain-language notes on how perfume works and how to wear it well in a hot, humid climate. These are general guidelines; your skin and nose are the final judge."
      />

      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-12">
        <nav aria-label="On this page" className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <p className="eyebrow mb-3">On this page</p>
            <ol className="space-y-1.5 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-2 hover:text-ink">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="max-w-3xl space-y-12">
          <Section id="concentrations" title="Concentrations">
            <p>
              Concentration describes how much aromatic material is dissolved in the alcohol base. Higher concentrations
              usually last longer, but they don’t always project further. Many extraits sit closer to the skin than an
              EDT.
            </p>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-sunken text-xs text-ink-2">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Typical oil %</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Typical wear</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Feel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {CONCENTRATION_ROWS.map(([type, pct, wear, feel]) => (
                    <tr key={type}>
                      <th scope="row" className="px-4 py-2.5 font-medium text-ink">{type}</th>
                      <td className="px-4 py-2.5 tabular-nums">{pct}</td>
                      <td className="px-4 py-2.5">{wear}</td>
                      <td className="px-4 py-2.5">{feel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-ink-3">
              Ranges are industry conventions, not rules. Each house defines its own, and an EDT from one brand can
              outlast an EDP from another. “Elixir”, “Intense” and “Absolu” are marketing names with no fixed meaning.
            </p>
          </Section>

          <Section id="pyramid" title="The note pyramid">
            <p>
              <strong>Top notes</strong> are the first impression: citrus, light spices, aldehydes. They are the most
              volatile and fade within roughly 15–30 minutes, faster in heat.
            </p>
            <p>
              <strong>Heart (middle) notes</strong> emerge as the top fades: florals, herbs, fruits and softer spices.
              They carry the character for the next few hours.
            </p>
            <p>
              <strong>Base notes</strong> are heavy molecules that anchor the scent and linger longest: woods, musks,
              amber, vanilla, resins. This long tail is called the <em>dry-down</em>.
            </p>
            <p>
              Notes listed by brands are often evocative rather than literal ingredients. “Sea notes” or “ambroxan”
              describe an impression or a synthetic material, not seawater or ambergris.
            </p>
          </Section>

          <Section id="families" title="Families and accords">
            <p>
              A <strong>note</strong> is a single smell you might pick out (bergamot, rose, vetiver). An{' '}
              <strong>accord</strong> is the impression several notes create together (“fresh spicy”, “powdery”,
              “gourmand”). A <strong>family</strong> is the broad category a perfume belongs to.
            </p>
            <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {[
                ['Citrus & aromatic', 'Bergamot, lemon, lavender, herbs: crisp and clean'],
                ['Aquatic & fresh', 'Marine, ozonic, watery: built for heat'],
                ['Floral', 'Rose, jasmine, iris, white flowers: soft to opulent'],
                ['Woody', 'Cedar, sandalwood, vetiver: dry, grounded'],
                ['Amber (oriental)', 'Resins, vanilla, spices: warm and enveloping'],
                ['Gourmand', 'Vanilla, caramel, coffee, tonka: edible-sweet'],
                ['Chypre', 'Citrus over oakmoss and patchouli: elegant, bittersweet'],
                ['Fougère', 'Lavender, coumarin, moss: classic barbershop'],
                ['Leather & smoky', 'Birch tar, suede, incense: dark and dry'],
              ].map(([name, desc]) => (
                <li key={name} className="text-sm">
                  <span className="font-medium text-ink">{name}.</span> {desc}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="performance" title="Performance terms">
            <p>
              <strong>Longevity</strong> is how long you can detect the scent on skin or clothing.{' '}
              <strong>Projection</strong> is how far it radiates from you, typically measured in the first hours.{' '}
              <strong>Sillage</strong> (French for “wake”) is the trail left in the air as you move through a room.
            </p>
            <p>
              <strong>Olfactory fatigue</strong> is why you stop smelling your own perfume after a few minutes, even
              though others still can. It’s the most common reason people over-spray. Studies have found that sniffing
              coffee beans resets your nose no better than fresh air. Smelling the crook of your own elbow works about as
              well.
            </p>
          </Section>

          <Section id="philippines" title="Wearing scent in Philippine weather">
            <p>
              <strong>Heat speeds everything up.</strong> In 30–35 °C, alcohol evaporates quickly, top notes flash off
              and projection rises for the first hour. Dense sweet or resinous scents can turn cloying. Spray less, and
              place it under clothing rather than on exposed skin.
            </p>
            <p>
              <strong>Humidity keeps scent close and heavy.</strong> Moist air slows evaporation from skin and lets sweet
              notes hang around you. Fresh citrus, aromatic, green and clean musk profiles stay pleasant. Save gourmands
              for air-conditioned evenings.
            </p>
            <p>
              <strong>Air-conditioning mutes projection.</strong> Cold, dry, recirculated air in offices, malls and
              cinemas suppresses diffusion but also traps scent in closed rooms. Don’t add sprays to compensate. A spray
              on fabric lasts longer without reaching across the room.
            </p>
            <p>
              <strong>Rainy season</strong> (roughly June to October, with typhoons) brings cooler, damp days where
              slightly warmer woods and soft spices shine. Rain on exposed skin dilutes fragrance, so favour skin under
              clothing.
            </p>
            <p>
              <strong>Crowded commutes</strong> in jeepneys, buses and trains put you at close quarters. Keep it to a skin
              scent there, and carry a travel atomiser to refresh after you arrive.
            </p>
            <p>
              Sweat dilutes and changes a scent, so apply to clean, dry skin straight after a shower. An unscented
              moisturiser underneath helps fragrance last on dry or freshly washed skin.
            </p>
            <p>
              <Link to="/spray-guide" className="link">
                Open the spray guide
              </Link>{' '}
              for counts and placement by occasion.
            </p>
          </Section>

          <Section id="storage" title="Storing bottles in tropical heat">
            <p>
              Heat, light and oxygen break perfume down. Signs of a turned bottle include a sour or flat opening and
              darker colour. In a home that sits at 28–32 °C without air-conditioning, storage matters more than usual.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Keep bottles in their boxes, in a closet or drawer away from windows and sunlight.</li>
              <li>Avoid the bathroom: steam and temperature swings are hard on fragrance.</li>
              <li>Never leave perfume in a parked car. Interior temperatures climb far above the outside air.</li>
              <li>
                A consistently cool spot beats a fridge you open often. Repeated cold-to-warm cycles cause condensation.
              </li>
              <li>Decant into a small atomiser for daily carry instead of taking the full bottle out.</li>
            </ul>
          </Section>

          <Section id="buying" title="Testing and buying">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Test on skin, not just paper strips. Skin chemistry and warmth change how a scent develops.</li>
              <li>Wait for the dry-down before deciding; the opening can be very different from hour three.</li>
              <li>Try no more than two or three scents at a time, on different spots.</li>
              <li>Wear a sample for a full day in your own weather before buying a full bottle.</li>
              <li>
                Buy from authorised retailers. Counterfeits are common online and in some marketplaces, and formulas can
                also change between batches.
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
