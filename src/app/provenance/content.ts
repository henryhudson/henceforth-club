export const HERO = {
  eyebrow: "Fresh produce specialists",
  headline: "Globally sourced exotic vegetables.",
  sub: "A vertically integrated supplier of premium and prepared produce to the UK's leading retailers, processors and food-service — since 2011.",
} as const;

export const ABOUT =
  "Provenance Partners is a vertically integrated supplier of globally produced and sourced exotic vegetables to market-leading retailers, processors and food-service companies in the UK. Founded in 2011 to market produce from Vegpro Kenya, the country's largest grower and exporter of fresh produce, we have since built a global network of world-class supply partners delivering year-round, best-in-class premium and prepared produce to millions of UK consumers.";

export type ValueIconKey =
  | "globe"
  | "handshake"
  | "shield"
  | "bolt"
  | "chart"
  | "sprout"
  | "star"
  | "bulb";

export const VALUES: { icon: ValueIconKey; title: string; body: string }[] = [
  {
    icon: "globe",
    title: "World-Class Partners",
    body: "We develop strong relationships with world-class supply partners, focused on meeting and exceeding our customers' product, technical and ethical requirements.",
  },
  {
    icon: "handshake",
    title: "Honesty & Integrity",
    body: "The cornerstone of our business. Every dealing is open and transparent, so all parties are clear on expectations.",
  },
  {
    icon: "shield",
    title: "Reliability & Value",
    body: "We pride ourselves on near-perfect service levels. Our global supply base ensures the best product, at the right price, from the right place.",
  },
  {
    icon: "bolt",
    title: "Lean, Fast & Efficient",
    body: "We continuously remove unnecessary cost from the supply chain — packing and labelling at source where possible, on a demand-driven basis.",
  },
  {
    icon: "chart",
    title: "Wealth of Experience",
    body: "A team of experts who have worked in the industry for many years, managing air- and sea-freight solutions across the globe.",
  },
  {
    icon: "sprout",
    title: "Technical Expertise",
    body: "Industry-leading technical expertise ensures food safety and compliance with ethical standards and values.",
  },
  {
    icon: "star",
    title: "Quality",
    body: "Our sourcing and technical experience ensures only the best product is supplied, sourced for just-in-time delivery.",
  },
  {
    icon: "bulb",
    title: "Product Development",
    body: "Strong relationships with seed houses to develop new varieties and products, backed by extensive trials with our suppliers.",
  },
];

export const SUPPLIERS =
  "Our strength is our network. We work with and develop world-class supply partners across the globe, chosen for their ability to meet — and exceed — exacting product, technical and ethical standards, so our customers can rely on best-in-class produce whatever the season.";

export const PREPARED = ["Mixed Prepared Vegetables", "Prepared Stir-Fry Vegetables"] as const;

export const PRODUCTS = [
  "Tenderstem® Broccoli",
  "Baby Corn",
  "Runner Beans",
  "Fine Beans",
  "Extra-Fine Beans",
  "Green Beans",
  "Twin & Triple Packs",
  "Baby Courgettes",
  "Sugar Snap Peas",
  "Baby Pak Choi",
  "Kale",
  "Echalion Shallots",
  "Mangetout",
  "Spring Onions",
  "Butternut",
  "Herbs",
] as const;

export const ACCREDITATIONS = [
  { name: "GlobalGAP", logo: "/provenance/accreditations/globalgap.png" },
  { name: "M&S", logo: "/provenance/accreditations/ms.png" },
  { name: "Sedex", logo: "/provenance/accreditations/sedex.png" },
  { name: "BRC", logo: "/provenance/accreditations/brc.png" },
  { name: "Fairtrade", logo: "/provenance/accreditations/fairtrade.png" },
] as const;

export const CONTACT = {
  address: "Unit 2.01 Clerkenwell Workshops, Clerkenwell Close, London, EC1R 0AT",
  email: "hello@provenance.co.uk",
  modernSlaveryPdf: "/provenance/modern-slavery-statement-2025.pdf",
} as const;
