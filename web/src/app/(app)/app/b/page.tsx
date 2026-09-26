import { Card } from "@/dapp/components/Card";
import { Page } from "@/dapp/components/Shell";

// Placeholder until this page is built (one app page at a time).
export default function BuyerProfilePage() {
    return (
        <Page>
            <Card className="w-full md:w-[524px]" title="Buyer profile" text="A buyer's payment record on Arc: accepted, paid on time, paid late and defaults." />
        </Page>
    );
}
