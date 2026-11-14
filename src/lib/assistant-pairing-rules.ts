// Owner confirmed this exact demo pair on 2026-11-11. Shared tags alone do not
// approve other pairs. Prices, identity and availability always come from the DB.
export const ownerPairingRules = [
  {
    id: "owner-minimal-commute-20261111-01",
    anchorSlug: "black-silk-shirt",
    candidateSlug: "black-wide-leg-pants",
    approvedOn: "2026-11-11",
    styles: ["极简"],
    occasions: ["通勤"],
    reason: "店主确认黑色真丝衬衫与黑色高腰阔腿裤适合作为极简通勤组合。",
  },
] as const;
