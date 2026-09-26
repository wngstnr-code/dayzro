import { Card } from "@/dapp/components/Card";
import { Page } from "@/dapp/components/Shell";

// Placeholder until this page is built (one app page at a time).
export default function InvoicesPage() {
    return (
        <Page>
            <Card className="w-full md:w-[524px]" title="Invoices" text="Every invoice you issued, owe or hold, read from the chain." />
        </Page>
    );
}
