import { Card } from "@/dapp/components/Card";
import { Page } from "@/dapp/components/Shell";

// Placeholder until this page is built (one app page at a time).
export default function FinancePage() {
    return (
        <Page>
            <Card className="w-full md:w-[524px]" title="Finance" text="Open a facility, fund it with USDC and set limits per buyer." />
        </Page>
    );
}
