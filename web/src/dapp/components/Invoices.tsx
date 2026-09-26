"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { type Address, isAddressEqual } from "viem";
import { arc } from "viem/chains";
import { useAccount, usePublicClient } from "wagmi";
import { registryAbi } from "@/dapp/abi/registry";
import { cn } from "@/dapp/lib/cn";
import { contracts, tokens } from "@/dapp/lib/contracts";
import { daysUntil, formatAmount, formatDate, plural } from "@/dapp/lib/format";
import { shortenAddress } from "@/dapp/lib/hooks";
import { Status, statusOf, toneClass } from "@/dapp/lib/receivable";
import { Card } from "./Card";
import { TokenIcon } from "./TokenIcon";

type Role = "issued" | "owed" | "held";

const filters: { id: "all" | Role; label: string }[] = [
    { id: "all", label: "All" },
    { id: "issued", label: "Issued" },
    { id: "owed", label: "To pay" },
    { id: "held", label: "Bought" },
];

const same = (a: Address, b: Address) => isAddressEqual(a, b);

/**
 * Every receivable the account touches, straight from the registry: ids it issued and ids it owes
 * (append-only per-party arrays), plus NFTs it holds (ERC-721 Enumerable), which covers bought ones.
 */
function useInvoices(account?: Address) {
    const client = usePublicClient({ chainId: arc.id });
    const registry = contracts.registry;

    return useQuery({
        queryKey: ["invoices", account, registry],
        enabled: !!client && !!registry && !!account,
        refetchInterval: 20_000,
        queryFn: async () => {
            const [supplied, owed, held] = await client!.multicall({
                allowFailure: false,
                contracts: [
                    { address: registry!, abi: registryAbi, functionName: "countBySupplier", args: [account!] },
                    { address: registry!, abi: registryAbi, functionName: "countByBuyer", args: [account!] },
                    { address: registry!, abi: registryAbi, functionName: "balanceOf", args: [account!] },
                ],
            });
            const [issuedIds, owedIds] = await client!.multicall({
                allowFailure: false,
                contracts: [
                    { address: registry!, abi: registryAbi, functionName: "idsBySupplier", args: [account!, BigInt(0), supplied] },
                    { address: registry!, abi: registryAbi, functionName: "idsByBuyer", args: [account!, BigInt(0), owed] },
                ],
            });
            const heldIds = await client!.multicall({
                allowFailure: false,
                contracts: Array.from({ length: Number(held) }, (_, i) => ({
                    address: registry!,
                    abi: registryAbi,
                    functionName: "tokenOfOwnerByIndex" as const,
                    args: [account!, BigInt(i)] as const,
                })),
            });

            const ids = [...new Set([...issuedIds, ...owedIds, ...heldIds])].sort(
                (a, b) => (a > b ? -1 : 1),
            );
            const rows = await client!.multicall({
                allowFailure: false,
                contracts: ids.map((id) => ({
                    address: registry!,
                    abi: registryAbi,
                    functionName: "getReceivable" as const,
                    args: [id] as const,
                })),
            });

            return ids.map((id, i) => {
                const [r, overdue, remaining, holder] = rows[i] as readonly [
                    { supplier: Address; buyer: Address; token: Address; faceAmount: bigint; dueDate: bigint; status: number },
                    boolean,
                    bigint,
                    Address,
                ];
                const roles: Role[] = [];
                if (same(r.supplier, account!)) roles.push("issued");
                if (same(r.buyer, account!)) roles.push("owed");
                if (same(holder, account!) && !same(r.supplier, account!)) roles.push("held");
                return { id, r, overdue, remaining, holder, roles, token: tokens.find((t) => same(t.address, r.token)) };
            });
        },
    });
}

export function Invoices() {
    const { address } = useAccount();
    const { data, isLoading, error } = useInvoices(address);
    const [filter, setFilter] = useState<"all" | Role>("all");

    const rows = (data ?? []).filter((row) => filter === "all" || row.roles.includes(filter));
    const counts = Object.fromEntries(
        filters.map((f) => [f.id, (data ?? []).filter((row) => f.id === "all" || row.roles.includes(f.id)).length]),
    );

    let body;
    if (!contracts.registry) {
        body = <Empty text="The registry address is not configured." />;
    } else if (!address) {
        body = <Empty text="Connect your wallet to see your invoices." />;
    } else if (isLoading) {
        body = (
            <div className="f-center py-[40px]">
                <span className="loading loading-spinner" />
            </div>
        );
    } else if (error) {
        body = <Empty text="Could not read your invoices from the chain." />;
    } else if (rows.length === 0) {
        body = (
            <Empty
                text={filter === "all" ? "No invoices yet. Bill a buyer and it shows up here." : "Nothing here yet."}
                cta={filter === "all" || filter === "issued"}
            />
        );
    } else {
        body = (
            <ul className="f-col divide-y divide-divider-border">
                {rows.map((row) => {
                    const status = statusOf(row.r.status, row.overdue);
                    const counterparty = row.roles.includes("owed") ? row.r.supplier : row.r.buyer;
                    const days = daysUntil(row.r.dueDate);
                    const live = row.r.status === Status.Pending || row.r.status === Status.Accepted;
                    return (
                        <li key={row.id.toString()}>
                            <Link
                                href={`/app/r/${row.id}`}
                                className="grid grid-cols-[1fr_auto] md:grid-cols-[64px_1fr_auto_auto] items-center gap-x-4 gap-y-1 px-3 py-[14px] -mx-3 rounded-[10px] hover:bg-primary-interactive-hover">
                                <span className="body-bold text-secondary-content hidden md:block">#{row.id.toString()}</span>
                                <span className="min-w-0">
                                    <span className="body-bold">
                                        {row.roles.includes("owed") ? "From " : "To "}
                                        {shortenAddress(counterparty, 6, 4)}
                                    </span>
                                    <span className="block text-sm text-tertiary-content">
                                        <span className="md:hidden">#{row.id.toString()} · </span>
                                        {row.roles.includes("held") ? "Bought, " : ""}due {formatDate(row.r.dueDate)}
                                        {live && (days >= 0 ? ` (in ${plural(days, "day")})` : ` (${plural(-days, "day")} late)`)}
                                    </span>
                                </span>
                                <span className="f-row items-center gap-2 justify-end body-bold">
                                    {row.token && <TokenIcon symbol={row.token.symbol} size={20} />}
                                    {formatAmount(row.r.faceAmount)} {row.token?.symbol}
                                </span>
                                <span
                                    className={cn(
                                        "col-span-2 md:col-span-1 justify-self-start md:justify-self-end px-3 py-1 rounded-full text-xs body-bold whitespace-nowrap",
                                        toneClass[status.tone],
                                    )}>
                                    {status.label}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <Card
            className="w-full md:w-[760px]"
            title="Invoices"
            text="Everything you issued, owe or bought, read from the chain.">
            {address && contracts.registry && (
                <div className="f-row flex-wrap gap-2 mt-[24px]">
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={cn(
                                filter === f.id ? "btn-primary text-white" : "btn-ghost",
                                "btn btn-sm h-[36px] min-h-[36px] px-[18px] rounded-full",
                            )}>
                            {f.label}
                            {data && <span className="opacity-70">{counts[f.id]}</span>}
                        </button>
                    ))}
                </div>
            )}
            <div className="mt-[20px]">{body}</div>
        </Card>
    );
}

function Empty({ text, cta = false }: { text: string; cta?: boolean }) {
    return (
        <div className="f-col items-center text-center gap-4 py-[40px] text-secondary-content">
            <p>{text}</p>
            {cta && (
                <Link href="/app" className="btn btn-primary text-white h-[40px] px-[28px] rounded-full">
                    New invoice
                </Link>
            )}
        </div>
    );
}
