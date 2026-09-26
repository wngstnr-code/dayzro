import { getAddress, isAddress } from "viem";
import { BuyerProfile } from "@/dapp/components/BuyerProfile";
import { Card } from "@/dapp/components/Card";
import { Page } from "@/dapp/components/Shell";

export default async function BuyerAddressPage({ params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    return (
        <Page>
            {isAddress(address) ? (
                <BuyerProfile address={getAddress(address)} />
            ) : (
                <Card className="w-full md:w-[524px]" title="Buyer not found" text="This link does not contain a valid address." />
            )}
        </Page>
    );
}
