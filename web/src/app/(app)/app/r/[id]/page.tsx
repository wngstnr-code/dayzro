import { Suspense } from "react";
import { Card } from "@/dapp/components/Card";
import { Receivable } from "@/dapp/components/Receivable";
import { Page } from "@/dapp/components/Shell";

export default async function ReceivablePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const valid = /^\d{1,20}$/.test(id) && BigInt(id) > BigInt(0);
    return (
        <Page>
            {valid ? (
                <Suspense>
                    <Receivable id={BigInt(id)} />
                </Suspense>
            ) : (
                <Card className="w-full md:w-[524px]" title="Invoice not found" text="This link does not point to an invoice." />
            )}
        </Page>
    );
}
