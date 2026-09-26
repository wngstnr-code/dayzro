import { BuyerProfile } from "@/dapp/components/BuyerProfile";
import { Page } from "@/dapp/components/Shell";

// Without an address: the connected wallet's own profile, or a lookup when disconnected.
export default function BuyerProfilePage() {
    return (
        <Page>
            <BuyerProfile />
        </Page>
    );
}
