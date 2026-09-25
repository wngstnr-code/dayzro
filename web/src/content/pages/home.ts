import type { HomePageData } from "@/content/types";

export const homePageData: HomePageData = {
  hero_title: "Get paid on day zero.",
  about_suptitle: "ABOUT DAYZRO",
  about_title: "We envision a world where no business waits 90 days to get paid",
  about_text:
    "Small suppliers quietly lend to their biggest customers, waiting 30 to 120 days on invoices they already delivered. Dayzro turns a buyer's approval into a receivable anyone can finance onchain, so suppliers get paid on day zero and financiers earn from real trade.",
  solution_screen_1_suptitle: "INVOICE FINANCING ON ARC",
  solution_screen_1_title:
    "Invoices<br>become cash",
  solution_screen_2_title:
    "<span>1</span> Accept",
  solution_screen_2_text:
    "Your buyer accepts the invoice onchain. It becomes a receivable with a fixed amount and due date.",
  solution_screen_3_title:
    "<span>2</span> Sell",
  solution_screen_3_text:
    "Sell it to a financier and get USDC the same day.",
  solution_screen_4_title:
    "<span>3</span> Settle",
  solution_screen_4_text:
    "On the due date the buyer pays the contract, and whoever holds the receivable is paid automatically.",
  governance_suptitle: "Trust",
  governance_title: "No custody, no backend, only contracts",
  governance_text:
    "Money moves between wallets and the Dayzro contracts on Arc. Every invoice, sale and payment is public and verifiable onchain, and the app runs entirely in your browser.",
  roadmap_suptitle: "Roadmap",
  roadmap_title: "Where Dayzro goes next",
  roadmap_list: [
    {
      id: 1,
      title: "Q4 2026",
      data: [
        { id: 1, text: "Registry and facility contracts live on Arc mainnet" },
        { id: 2, text: "Create, accept, finance and settle invoices in the app" },
        { id: 3, text: "Receivables in USDC and EURC" },
      ],
    },
    {
      id: 2,
      title: "Q1 2027",
      data: [
        { id: 4, text: "Buyer guarantees and per buyer limits in the app" },
        { id: 5, text: "Public payment history for every buyer" },
        { id: 6, text: "Financier dashboard for facilities" },
      ],
    },
    {
      id: 3,
      title: "Q2 2027",
      data: [
        { id: 7, text: "Independent security audit" },
        { id: 8, text: "Accounting exports for suppliers" },
        { id: 9, text: "More stablecoins as Arc adds them" },
      ],
    },
  ],
};
