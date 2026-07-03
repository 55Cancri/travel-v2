import type { Db, Item } from "./types";

// Demo data = the real Europe 2026 trip, transcribed from the Figma boards, so
// day one in the app is with real places (and real pins on the map).

const item = (partial: Partial<Item> & Pick<Item, "id" | "text">): Item => ({
  kind: "activity",
  status: "planned",
  ...partial,
});

const items: Item[] = [
  // ---- Amsterdam idea pool (museums / parks / third places) ----
  item({
    id: "ams-anne-frank",
    text: "Anne Frank Huis",
    note: "tickets release on the 31st",
    place: { name: "Anne Frank Huis", lat: 52.37522, lng: 4.88397 },
  }),
  item({
    id: "ams-tulip",
    text: "Tulip Museum",
    place: { name: "Amsterdam Tulip Museum", lat: 52.37559, lng: 4.88345 },
  }),
  item({
    id: "ams-banksy",
    text: "Banksy (Moco Museum)",
    place: { name: "Moco Museum", lat: 52.35817, lng: 4.88171 },
  }),
  item({
    id: "ams-vangogh",
    text: "Van Gogh & Rembrandt",
    place: { name: "Van Gogh Museum", lat: 52.35843, lng: 4.8811 },
  }),
  item({
    id: "ams-sexmuseum",
    text: "Sex Museum",
    place: { name: "Sexmuseum Amsterdam", lat: 52.37478, lng: 4.8971 },
  }),
  item({
    id: "ams-rijks",
    text: "Rijksmuseum",
    place: { name: "Rijksmuseum", lat: 52.36, lng: 4.88522 },
  }),
  item({
    id: "ams-bloemenmarkt",
    text: "Bloemenmarkt (flower market)",
    place: { name: "Bloemenmarkt", lat: 52.36681, lng: 4.89109 },
  }),
  item({
    id: "ams-jordaan",
    text: "Jordaan canals walk",
    place: { name: "Jordaan", lat: 52.3736, lng: 4.8817 },
  }),
  item({
    id: "ams-westerpark",
    text: "Westerpark",
    place: { name: "Westerpark", lat: 52.38655, lng: 4.8783 },
  }),
  item({
    id: "ams-vondelpark",
    text: "Vondelpark — Openluchttheater",
    note: "Fri 7/31 8.3p dance · Sat 8/1 3p music",
    place: { name: "Vondelpark", lat: 52.35792, lng: 4.86861 },
  }),
  item({
    id: "ams-oba",
    text: "Openbare Bibliotheek (central library)",
    place: { name: "OBA Oosterdok", lat: 52.37623, lng: 4.908 },
  }),
  item({
    id: "ams-debalie",
    text: "De Balie",
    note: "cultural center near Leidseplein — debates, film, lively foyer",
    place: { name: "De Balie", lat: 52.36394, lng: 4.88235 },
  }),
  item({
    id: "ams-flight-in",
    text: "Flight KL0668 · AUS → AMS",
    kind: "transport",
    details: {
      dates: "Mon Jul 27 6:05p → Tue Jul 28 10:30a (overnight)",
      code: "KL0668",
    },
    place: { name: "Schiphol Airport", lat: 52.30861, lng: 4.76389 },
  }),
  item({
    id: "ams-flight-bru",
    text: "Flight KL1705 · AMS → BRU",
    kind: "transport",
    status: "cancelled",
    note: "taking the train instead",
    details: { dates: "Tue Jul 28 2:44p", code: "KL1705" },
  }),
  item({
    id: "ams-hostel",
    text: "The Elephant Hostel",
    kind: "lodging",
    details: {
      address: "Plantage Middenlaan 17, 1018 DA Amsterdam",
      dates: "Tue Jul 28",
      checkIn: "2:00 PM",
      checkOut: "11:00 AM",
      code: "#56KCMT126P",
      phone: "+31 20 792 0645",
    },
    place: {
      name: "The Elephant Hostel",
      lat: 52.36578,
      lng: 4.91198,
      address: "Plantage Middenlaan 17",
    },
  }),

  // ---- Amsterdam · Day 1 — Jul 28, "To the beach" ----
  item({ id: "d1-arrive", text: "Arrive in Amsterdam", kind: "transport", time: "10:30a" }),
  item({ id: "d1-breakfast", text: "Breakfast at __", kind: "food", time: "11:15a" }),
  item({
    id: "d1-train-haarlem",
    text: "Train to Haarlem (11 min)",
    kind: "transport",
    time: "12:30p",
    place: { name: "Haarlem Station", lat: 52.38779, lng: 4.63831 },
  }),
  item({
    id: "d1-grote-markt",
    text: "Walk the Grote Markt & the Gouden Straatjes",
    time: "12:45p",
    place: { name: "Grote Markt, Haarlem", lat: 52.38125, lng: 4.63706 },
  }),
  item({
    id: "d1-teylers",
    text: "Teylers Museum",
    note: "Netherlands' oldest museum",
    place: { name: "Teylers Museum", lat: 52.38091, lng: 4.6401 },
  }),
  item({
    id: "d1-molen",
    text: "Molen de Adriaan windmill",
    place: { name: "Molen de Adriaan", lat: 52.38133, lng: 4.64896 },
  }),
  item({
    id: "d1-bavo",
    text: "See the organ at St. Bavo",
    note: "this is where Mozart played",
    place: { name: "Grote Kerk St. Bavo", lat: 52.38079, lng: 4.63678 },
  }),
  item({ id: "d1-dinner", text: "Get dinner before leaving", kind: "food" }),
  item({
    id: "d1-zandvoort",
    text: "Check in — Zandvoort room",
    kind: "lodging",
    time: "4p",
    details: {
      address: "Haltestraat 23B, Zandvoort, North Holland 2042 LK",
      checkIn: "3:00 PM – 10:00 PM",
      checkOut: "before 11:00 AM",
    },
    place: { name: "Haltestraat 23B, Zandvoort", lat: 52.37478, lng: 4.53215 },
  }),
  item({
    id: "d1-ah",
    text: "Albert Heijn — vegan groceries",
    kind: "food",
    place: { name: "Albert Heijn Zandvoort", lat: 52.37589, lng: 4.53103 },
  }),
  item({ id: "d1-stroll", text: "Stroll the car-free city center", time: "4–5:30p" }),
  item({
    id: "d1-bikes",
    text: "Ride bikes through Zuid-Kennemerland",
    note: "find deer and foxes",
    place: { name: "Zuid-Kennemerland NP", lat: 52.40268, lng: 4.57917 },
  }),
  item({
    id: "d1-biolum",
    text: "Go find bioluminescence!!",
    place: { name: "Zandvoort beach", lat: 52.37183, lng: 4.52487 },
  }),

  // ---- Amsterdam · Day 2 — Jul 29 ----
  item({ id: "d2-return", text: "Return from Zandvoort", kind: "transport", time: "11a" }),
  item({ id: "d2-luggage", text: "Find luggage storage", time: "11:15a" }),
  item({ id: "d2-breakfast", text: "Breakfast at __", kind: "food", time: "11:45a–1p" }),
  item({
    id: "d2-nemo",
    text: "NEMO Science Museum",
    time: "1–5p",
    place: { name: "NEMO Science Museum", lat: 52.374, lng: 4.9123 },
  }),
  item({
    id: "d2-dinner",
    text: "Dinner at __ in Dam Square",
    kind: "food",
    time: "5:30–6:30p",
    place: { name: "Dam Square", lat: 52.37312, lng: 4.89345 },
  }),
  item({ id: "d2-dam", text: "Wander around Dam Square a bit", time: "6:30p" }),
  item({
    id: "d2-rokin",
    text: "Walk through the Rokin metro station",
    time: "7–7:30p",
    place: { name: "Rokin Station", lat: 52.37024, lng: 4.8929 },
  }),
  item({
    id: "d2-redlight",
    text: "Free Red Light District walking tour",
    time: "7:30p–?",
    note: "in person or audio? starts at Centraal Station — 6:30–8 or 8:30–10",
    place: { name: "Amsterdam Centraal", lat: 52.37888, lng: 4.90042 },
  }),

  // ---- Paris pool ----
  item({
    id: "par-cesure",
    text: "Césure (third place)",
    note: "former Sorbonne-Nouvelle campus — massive community center, workspaces for artists",
    place: { name: "Césure", lat: 48.844, lng: 2.353 },
  }),
  item({
    id: "par-cite-fertile",
    text: "La Cité Fertile (third place)",
    note: "ecology incubator in a former railway warehouse in Pantin",
    place: { name: "La Cité Fertile", lat: 48.8968, lng: 2.4065 },
  }),
  item({
    id: "par-point-ephemere",
    text: "Point Éphémère (third place)",
    place: { name: "Point Éphémère", lat: 48.8771, lng: 2.3679 },
  }),
  item({
    id: "par-arts-metiers",
    text: "Musée des Arts et Métiers (science museum)",
    place: { name: "Musée des Arts et Métiers", lat: 48.8663, lng: 2.3554 },
  }),
  item({
    id: "par-carnavalet",
    text: "Carnavalet Museum (history)",
    place: { name: "Musée Carnavalet", lat: 48.8573, lng: 2.3628 },
  }),
  item({
    id: "par-versailles",
    text: "Palace of Versailles",
    place: { name: "Château de Versailles", lat: 48.80443, lng: 2.12035 },
  }),

  // ---- Paris · Day 5 — Aug 1 ----
  item({
    id: "d5-arc",
    text: "Arc de Triomphe",
    place: { name: "Arc de Triomphe", lat: 48.8738, lng: 2.295 },
  }),
  item({
    id: "d5-eiffel",
    text: "Eiffel Tower",
    place: { name: "Eiffel Tower", lat: 48.85837, lng: 2.29448 },
  }),
  item({
    id: "d5-louvre",
    text: "Louvre",
    place: { name: "Louvre", lat: 48.86061, lng: 2.33764 },
  }),
  item({
    id: "d5-catacombs",
    text: "Catacombs",
    place: { name: "Catacombes de Paris", lat: 48.83396, lng: 2.33244 },
  }),
  item({
    id: "d5-figure",
    text: "Figure drawing — Académie de la Grande Chaumière",
    time: "1:15–4:30p",
    place: { name: "Académie de la Grande Chaumière", lat: 48.84234, lng: 2.331 },
  }),
  item({
    id: "d5-villette",
    text: "Parc de la Villette — open air concert",
    time: "6–9p",
    place: { name: "Parc de la Villette", lat: 48.8934, lng: 2.3904 },
  }),

  // ---- Paris · Day 7 — Aug 3 ----
  item({
    id: "d7-hotel",
    text: "Hotel Hoy",
    kind: "lodging",
    details: {
      address: "68 Rue des Martyrs, 75009 Paris",
      dates: "Aug 3 – Aug 5",
      checkIn: "3:00 PM",
      checkOut: "12:00 PM",
      code: "#KBQHSP",
      phone: "+01 27 017-737-8720",
    },
    place: { name: "Hotel Hoy", lat: 48.8789, lng: 2.3404, address: "68 Rue des Martyrs" },
  }),

  // ---- Belgium pool ----
  item({
    id: "bel-antwerp-station",
    text: "Antwerp — Central Station",
    note: "most beautiful in the world",
    place: { name: "Antwerpen-Centraal", lat: 51.21722, lng: 4.42111 },
  }),
  item({
    id: "bel-rubenshuis",
    text: "Antwerp — Rubenshuis",
    place: { name: "Rubenshuis", lat: 51.2177, lng: 4.4088 },
  }),
  item({
    id: "bel-cathedral",
    text: "Antwerp — Cathedral of Our Lady (Rubens)",
    place: { name: "Cathedral of Our Lady", lat: 51.2204, lng: 4.4013 },
  }),
  item({
    id: "bel-gravensteen",
    text: "Ghent — Gravensteen castle",
    place: { name: "Gravensteen", lat: 51.0574, lng: 3.7209 },
  }),
  item({
    id: "bel-mystic-lamb",
    text: "Ghent — Adoration of the Mystic Lamb, St Bavo's",
    place: { name: "St Bavo's Cathedral", lat: 51.053, lng: 3.7268 },
  }),
  item({
    id: "bel-graffiti",
    text: "Ghent — Werregarenstraat (graffiti street)",
    place: { name: "Werregarenstraat", lat: 51.0548, lng: 3.7252 },
  }),
  item({
    id: "bel-grand-place",
    text: "Brussels — Grand-Place",
    place: { name: "Grand-Place", lat: 50.8467, lng: 4.3525 },
  }),
  item({
    id: "bel-atomium",
    text: "Brussels — Atomium (no food up here)",
    place: { name: "Atomium", lat: 50.8949, lng: 4.3414 },
  }),
  item({
    id: "bel-magritte",
    text: "Brussels — Magritte Museum (surrealism)",
    place: { name: "Musée Magritte", lat: 50.8438, lng: 4.3576 },
  }),
  item({
    id: "bel-comic",
    text: "Brussels — Comic Strip Center",
    place: { name: "Belgian Comic Strip Center", lat: 50.8511, lng: 4.3602 },
  }),
  item({
    id: "bel-mont-des-arts",
    text: "Brussels — Mont des Arts (panoramic views)",
    place: { name: "Mont des Arts", lat: 50.8439, lng: 4.3561 },
  }),
  item({
    id: "bel-judgy-vegan",
    text: "Brussels — The Judgy Vegan (top rated, belgian)",
    kind: "food",
    place: { name: "The Judgy Vegan", lat: 50.8365, lng: 4.3491 },
  }),
];

export const seed: Db = {
  version: 1,
  tripOrder: ["europe-2026"],
  trips: {
    "europe-2026": {
      id: "europe-2026",
      name: "Europe 2026",
      dates: "Jul 27 – Aug 10",
      segmentIds: ["ams", "par", "bel"],
    },
  },
  segments: {
    ams: {
      id: "ams",
      name: "Amsterdam",
      dayIds: ["ams-d1", "ams-d2"],
      poolItemIds: [
        "ams-flight-in",
        "ams-flight-bru",
        "ams-hostel",
        "ams-anne-frank",
        "ams-rijks",
        "ams-vangogh",
        "ams-banksy",
        "ams-tulip",
        "ams-sexmuseum",
        "ams-bloemenmarkt",
        "ams-jordaan",
        "ams-westerpark",
        "ams-vondelpark",
        "ams-oba",
        "ams-debalie",
      ],
    },
    par: {
      id: "par",
      name: "Paris",
      dayIds: ["par-d5", "par-d7"],
      poolItemIds: [
        "par-cesure",
        "par-cite-fertile",
        "par-point-ephemere",
        "par-arts-metiers",
        "par-carnavalet",
        "par-versailles",
      ],
    },
    bel: {
      id: "bel",
      name: "Belgium",
      dayIds: [],
      poolItemIds: [
        "bel-antwerp-station",
        "bel-rubenshuis",
        "bel-cathedral",
        "bel-gravensteen",
        "bel-mystic-lamb",
        "bel-graffiti",
        "bel-grand-place",
        "bel-atomium",
        "bel-magritte",
        "bel-comic",
        "bel-mont-des-arts",
        "bel-judgy-vegan",
      ],
    },
  },
  days: {
    "ams-d1": {
      id: "ams-d1",
      date: "2026-07-28",
      title: "To the beach",
      itemIds: [
        "d1-arrive",
        "d1-breakfast",
        "d1-train-haarlem",
        "d1-grote-markt",
        "d1-teylers",
        "d1-molen",
        "d1-bavo",
        "d1-dinner",
        "d1-zandvoort",
        "d1-ah",
        "d1-stroll",
        "d1-bikes",
        "d1-biolum",
      ],
    },
    "ams-d2": {
      id: "ams-d2",
      date: "2026-07-29",
      itemIds: [
        "d2-return",
        "d2-luggage",
        "d2-breakfast",
        "d2-nemo",
        "d2-dinner",
        "d2-dam",
        "d2-rokin",
        "d2-redlight",
      ],
    },
    "par-d5": {
      id: "par-d5",
      date: "2026-08-01",
      itemIds: ["d5-arc", "d5-eiffel", "d5-louvre", "d5-catacombs", "d5-figure", "d5-villette"],
    },
    "par-d7": {
      id: "par-d7",
      date: "2026-08-03",
      itemIds: ["d7-hotel"],
    },
  },
  items: Object.fromEntries(items.map((entry) => [entry.id, entry])),
};
