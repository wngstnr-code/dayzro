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
  audience_suptitle: "Who it's for",
  audience_title: "Built for everyone in the trade",
  audience_list: [
    {
      id: 1,
      title: "Suppliers",
      points: [
        "Get paid the day your buyer accepts the invoice",
        "No collateral and no bank loan to apply for",
        "Keep the full invoice value minus a small discount",
      ],
    },
    {
      id: 2,
      title: "Buyers",
      points: [
        "Pay on your usual terms, nothing changes for you",
        "Accept an invoice with one wallet signature",
        "Build an onchain payment record financiers can price",
      ],
    },
    {
      id: 3,
      title: "Financiers",
      points: [
        "Earn yield from real trade, not token emissions",
        "Short tenors, priced onchain at a clear APR",
        "Cap your exposure to every buyer you finance",
      ],
    },
  ],
};
