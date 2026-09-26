import { Card } from "@/dapp/components/Card";
import { Page } from "@/dapp/components/Shell";

// Placeholder until this page is built (one app page at a time).
export default async function ReceivablePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <Page>
            <Card
                className="w-full md:w-[524px]"
                title={`Invoice #${id}`}
                text="Terms, status and the next action for each side: accept, sell, pay or settle."
            />
        </Page>
    );
}
