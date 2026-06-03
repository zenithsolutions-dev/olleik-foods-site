/**
 * Resource hub content. These three starter articles are evergreen, accurate,
 * and genuinely useful — written to attract operators searching for help, not
 * to make claims about Olleik specifically. Add, edit, or replace freely.
 * For a larger blog you'd likely move this to MDX or a CMS later.
 */

export type Section = { heading?: string; paragraphs: string[] };

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  tag: string;
  readMins: number;
  metaDescription: string;
  sections: Section[];
};

export const articles: Article[] = [
  {
    slug: "questions-before-choosing-a-wholesale-food-supplier",
    title: "7 questions to ask before choosing a wholesale food supplier",
    excerpt:
      "Switching suppliers is disruptive, so it's worth getting right. These seven questions cut through the sales pitch.",
    tag: "Buyer's guide",
    readMins: 5,
    metaDescription:
      "A practical checklist of seven questions every restaurant or food business should ask before signing with a wholesale food supplier — delivery, minimums, pricing, and more.",
    sections: [
      {
        paragraphs: [
          "Changing food suppliers means retraining receiving, re-checking specs, and trusting someone new with your margins. Before you sign anything, get clear answers to these seven questions.",
        ],
      },
      {
        heading: "1. What does delivery actually look like?",
        paragraphs: [
          "Ask for the specific days, the delivery window, and the order cut-off time for your area. \"We deliver daily\" means little if your window is unpredictable. Reliable, plannable windows are what let your kitchen prep without waiting on a truck.",
        ],
      },
      {
        heading: "2. What is the real minimum order?",
        paragraphs: [
          "Some distributors set minimums designed for chains. For an independent kitchen, a high per-drop minimum forces over-ordering and waste. Ask about both the per-delivery minimum and any monthly volume commitment.",
        ],
      },
      {
        heading: "3. How is pricing set — and how often does it change?",
        paragraphs: [
          "Understand whether you're on list pricing or contract pricing, and how price changes are communicated. Stable, transparent pricing you can budget around beats a low headline price that drifts upward every few weeks.",
        ],
      },
      {
        heading: "4. Who is my actual point of contact?",
        paragraphs: [
          "A dedicated rep who knows your menu can handle substitutions and special orders in minutes. A call center cannot. Ask who you'll talk to when something goes wrong at 6am.",
        ],
      },
      {
        heading: "5. What happens when product is off-spec?",
        paragraphs: [
          "Things occasionally arrive wrong. The question is how fast it's made right. Look for a clear, same-day credit process rather than a claims form and a wait.",
        ],
      },
      {
        heading: "6. How do they handle the cold chain?",
        paragraphs: [
          "Refrigerated trucks and temperature logging aren't a nicety — they're food safety. Ask how cold product is kept cold from their dock to your door.",
        ],
      },
      {
        heading: "7. Can they grow with you?",
        paragraphs: [
          "If you add covers, a second location, or catering, can the supplier flex? The right partner makes scaling easier instead of becoming the bottleneck.",
        ],
      },
      {
        heading: "The bottom line",
        paragraphs: [
          "A good supplier relationship is measured in years, not invoices. Ask the hard questions up front and choose the partner who answers them plainly.",
        ],
      },
    ],
  },
  {
    slug: "how-wholesale-food-pricing-works",
    title: "How wholesale food pricing actually works",
    excerpt:
      "Tiers, contracts, net-30, and market items — a plain-English guide to what's behind your wholesale invoice.",
    tag: "Explainer",
    readMins: 4,
    metaDescription:
      "A plain-English explainer of how wholesale food pricing works for restaurants — price tiers, contract pricing, market items, and net-30 terms.",
    sections: [
      {
        paragraphs: [
          "Wholesale pricing can feel opaque, especially when two kitchens pay different amounts for the same case. Here's what's usually going on.",
        ],
      },
      {
        heading: "Price tiers",
        paragraphs: [
          "Most distributors group customers into tiers based on volume and order patterns. Higher, steadier volume typically earns better pricing. This is why a public price list rarely reflects what any individual account actually pays.",
        ],
      },
      {
        heading: "Contract vs. market pricing",
        paragraphs: [
          "Staple items are often set on contract for a period, giving you a stable cost to build menus around. \"Market\" items — produce and proteins especially — move with supply and season, so their price can change week to week.",
        ],
      },
      {
        heading: "Net-30 and terms",
        paragraphs: [
          "Established accounts often qualify for net-30 invoicing, meaning you pay within 30 days rather than on delivery. New accounts typically start prepaid or card-on-file until a payment history is built. Terms are a cash-flow tool — used well, they smooth out your week.",
        ],
      },
      {
        heading: "What to ask for",
        paragraphs: [
          "Ask which of your items are contract vs. market, how often contract pricing is reviewed, and whether your rep will flag big market swings before they hit your invoice. Predictability is worth as much as the headline number.",
        ],
      },
    ],
  },
  {
    slug: "cut-food-cost-without-cutting-quality",
    title: "Cutting food cost without cutting quality: a kitchen checklist",
    excerpt:
      "Six levers that protect your margin without touching the guest experience.",
    tag: "Operations",
    readMins: 4,
    metaDescription:
      "Six practical ways restaurants can reduce food cost without lowering quality — from spec discipline and yield to ordering rhythm and supplier review.",
    sections: [
      {
        paragraphs: [
          "Food cost creeps up quietly. These six levers protect margin without anyone at the table noticing a difference.",
        ],
      },
      {
        heading: "1. Tighten your specs",
        paragraphs: [
          "Order the exact pack size, grade, and cut you need. Buying a higher grade than the dish requires is silent waste; so is a pack size that forces you to throw product away.",
        ],
      },
      {
        heading: "2. Track yield, not just price",
        paragraphs: [
          "The cheaper case isn't cheaper if it yields less usable product. Compare cost per usable portion, not cost per case.",
        ],
      },
      {
        heading: "3. Build an ordering rhythm",
        paragraphs: [
          "Ordering to a consistent par level reduces both stock-outs and over-ordering. Erratic ordering is where waste and rush-order premiums live.",
        ],
      },
      {
        heading: "4. Use your rep",
        paragraphs: [
          "A good supplier rep can suggest equivalent items, seasonal swaps, and better pack sizes. That's free menu engineering — use it.",
        ],
      },
      {
        heading: "5. Cross-utilize ingredients",
        paragraphs: [
          "The more dishes an ingredient appears in, the less likely it sits and spoils. Design the menu so your inventory works harder.",
        ],
      },
      {
        heading: "6. Review pricing on a schedule",
        paragraphs: [
          "Set a quarterly reminder to review your top items against the market. A short conversation with your supplier a few times a year usually pays for itself many times over.",
        ],
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
