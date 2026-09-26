"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ChangeEvent, type ReactNode, useState } from "react";
import { type Address, erc20Abi, isAddressEqual, keccak256, parseUnits, toBytes, zeroAddress } from "viem";
import { arc } from "viem/chains";
import { useAccount, usePublicClient } from "wagmi";
import { facilityAbi } from "@/dapp/abi/facility";
import { registryAbi } from "@/dapp/abi/registry";
import { cn } from "@/dapp/lib/cn";
import { contracts, explorerTx, tokens } from "@/dapp/lib/contracts";
import { daysUntil, formatAmount, formatDate, plural } from "@/dapp/lib/format";
import { shortenAddress } from "@/dapp/lib/hooks";
import { FLAG_GUARANTEED, Status, statusOf, toneClass } from "@/dapp/lib/receivable";
import { busyLabel, type Call, useSendTx } from "@/dapp/lib/tx";
import { ActionButton } from "./Buttons";
import { Card, Step, Stepper } from "./Card";
import { Icon } from "./Icon";
import { TokenIcon } from "./TokenIcon";

const DEFAULT_GRACE = 30 * 24 * 60 * 60;
const MAX_FACILITIES_SCANNED = 50;

type Offer = { fid: bigint; price: bigint; fee: bigint; aprBps: number };

function same(a?: string, b?: string) {
    return !!a && !!b && isAddressEqual(a as Address, b as Address);
}

/** Everything the page needs in one pass: the receivable, plus what the viewer's role can act on. */
function useReceivable(id: bigint, viewer?: Address) {
    const client = usePublicClient({ chainId: arc.id });
    const registry = contracts.registry;
    const facility = contracts.facility;

    return useQuery({
        queryKey: ["receivable", id.toString(), viewer, registry],
        enabled: !!client && !!registry,
        refetchInterval: 15_000,
        queryFn: async () => {
            const [r, overdue, remaining, holder] = await client!.readContract({
                address: registry!,
                abi: registryAbi,
                functionName: "getReceivable",
                args: [id],
            });
            if (r.status === Status.None) {
                // Only call it missing when the id is past the last one issued; anything else is a bad read.
                const total = await client!.readContract({ address: registry!, abi: registryAbi, functionName: "totalReceivables" });
                if (id <= total) throw new Error("Receivable read returned empty data");
                return null;
            }
            const token = tokens.find((t) => same(t.address, r.token));

            const extra: {
                guaranteeFree?: bigint;
                allowance?: bigint;
                balance?: bigint;
                claimable?: bigint;
                offer?: Offer;
                noOfferReason?: string;
                nftApproved?: boolean;
            } = {};

            if (viewer) {
                const [allowance, balance, claimable, guarantee] = await client!.multicall({
                    allowFailure: false,
                    contracts: [
                        { address: r.token, abi: erc20Abi, functionName: "allowance", args: [viewer, registry!] },
                        { address: r.token, abi: erc20Abi, functionName: "balanceOf", args: [viewer] },
                        { address: registry!, abi: registryAbi, functionName: "claimable", args: [viewer, r.token] },
                        { address: registry!, abi: registryAbi, functionName: "guaranteeOf", args: [r.buyer, r.token] },
                    ],
                });
                Object.assign(extra, { allowance, balance, claimable, guaranteeFree: guarantee[0] - guarantee[1] });

                // Best facility offer, only for the holder of an accepted receivable.
                if (facility && r.status === Status.Accepted && same(viewer, holder)) {
                    const count = await client!.readContract({ address: facility, abi: facilityAbi, functionName: "facilityCount" });
                    const n = Number(count > BigInt(MAX_FACILITIES_SCANNED) ? BigInt(MAX_FACILITIES_SCANNED) : count);
                    const fids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
                    const results = await client!.multicall({
                        allowFailure: true,
                        contracts: fids.flatMap((fid) => [
                            { address: facility, abi: facilityAbi, functionName: "quote", args: [fid, id] } as const,
                            { address: facility, abi: facilityAbi, functionName: "getFacility", args: [fid] } as const,
                        ]),
                    });
                    let reason: string | undefined;
                    fids.forEach((fid, i) => {
                        const q = results[i * 2];
                        const f = results[i * 2 + 1];
                        if (q.status !== "success" || f.status !== "success") return;
                        const [ok, price, fee, why] = q.result as readonly [boolean, bigint, bigint, string];
                        const terms = f.result as { aprBps: number };
                        if (!ok) {
                            reason ??= why;
                            return;
                        }
                        if (!extra.offer || price - fee > extra.offer.price - extra.offer.fee) {
                            extra.offer = { fid, price, fee, aprBps: terms.aprBps };
                        }
                    });
                    if (!extra.offer) extra.noOfferReason = n === 0 ? "no facilities" : reason;

                    const [approved, forAll] = await client!.multicall({
                        allowFailure: false,
                        contracts: [
                            { address: registry!, abi: registryAbi, functionName: "getApproved", args: [id] },
                            { address: registry!, abi: registryAbi, functionName: "isApprovedForAll", args: [viewer, facility] },
                        ],
                    });
                    extra.nftApproved = same(approved, facility) || forAll;
                }
            }

            return { r, overdue, remaining, holder, token, ...extra };
        },
    });
}

type Data = NonNullable<ReturnType<typeof useReceivable>["data"]>;

// ---------------------------------------------------------------- presentation

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="f-between-center gap-4 py-[10px]">
            <span className="text-secondary-content shrink-0">{label}</span>
            <span className="text-right min-w-0">{children}</span>
        </div>
    );
}

function Party({ address, you }: { address: Address; you: boolean }) {
    return (
        <Link href={`/app/b/${address}`} className="hover:underline" title={address}>
            {shortenAddress(address, 6, 4)}
            {you && <span className="text-tertiary-content"> (you)</span>}
        </Link>
    );
}

/** Lets anyone check a file against the fingerprint stored at issuance. */
function DocumentCheck({ docHash }: { docHash: `0x${string}` }) {
    const [result, setResult] = useState<"match" | "mismatch">();
    const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const hash = keccak256(new Uint8Array(await file.arrayBuffer()));
        setResult(hash === docHash ? "match" : "mismatch");
    };
    return (
        <span className="f-row items-center justify-end gap-2">
            {result === "match" && <span className="text-positive-sentiment">Matches</span>}
            {result === "mismatch" && <span className="text-negative-sentiment">Different file</span>}
            <label className="link cursor-pointer">
                Check a file
                <input type="file" className="hidden" onChange={onFile} />
            </label>
        </span>
    );
}

// ---------------------------------------------------------------- actions

function ActionPanel({ d, id, viewer, onDone }: { d: Data; id: bigint; viewer?: Address; onDone: () => void }) {
    const { send, state, busy, reset } = useSendTx();
    const [guaranteed, setGuaranteed] = useState(false);
    const [payInput, setPayInput] = useState<string>();
    const registry = contracts.registry!;
    const token = d.token;
    const symbol = token?.symbol ?? "";

    const isBuyer = same(viewer, d.r.buyer);
    const isSupplier = same(viewer, d.r.supplier);
    const isHolder = same(viewer, d.holder);
    const now = Math.floor(Date.now() / 1000);
    const isGuaranteed = (d.r.flags & FLAG_GUARANTEED) !== 0;
    const open = d.r.status === Status.Accepted || d.r.status === Status.Defaulted;

    const run = async (calls: Call[]) => {
        reset();
        if (await send(calls)) onDone();
    };

    const blocks: ReactNode[] = [];

    // Buyer confirms the debt (optionally backed by their guarantee) or refuses it.
    if (d.r.status === Status.Pending && isBuyer) {
        const canGuarantee = (d.guaranteeFree ?? BigInt(0)) >= d.r.faceAmount;
        blocks.push(
            <div key="accept" className="f-col gap-4">
                {canGuarantee && (
                    <label className="f-row items-center gap-3 cursor-pointer text-secondary-content">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={guaranteed}
                            onChange={(e) => setGuaranteed(e.target.checked)}
                        />
                        Back it with my guarantee ({formatAmount(d.guaranteeFree!)} {symbol} free)
                    </label>
                )}
                <ActionButton
                    priority="primary"
                    disabled={busy}
                    onClick={() =>
                        run([{ label: "Accept", address: registry, abi: registryAbi, functionName: "accept", args: [id, guaranteed] }])
                    }>
                    <span className="body-bold">Accept invoice</span>
                </ActionButton>
                <ActionButton
                    priority="secondary"
                    disabled={busy}
                    onClick={() => run([{ label: "Reject", address: registry, abi: registryAbi, functionName: "reject", args: [id] }])}>
                    <span className="body-bold">Reject</span>
                </ActionButton>
            </div>,
        );
    }

    if (d.r.status === Status.Pending && isSupplier) {
        blocks.push(
            <ActionButton
                key="cancel"
                priority="secondary"
                disabled={busy}
                onClick={() => run([{ label: "Cancel", address: registry, abi: registryAbi, functionName: "cancel", args: [id] }])}>
                <span className="body-bold">Cancel invoice</span>
            </ActionButton>,
        );
    }

    // Holder sells to the facility paying the most right now.
    if (d.r.status === Status.Accepted && isHolder && !d.overdue && contracts.facility) {
        const facility = contracts.facility;
        if (d.offer) {
            const o = d.offer;
            const calls: Call[] = [];
            if (!d.nftApproved) {
                calls.push({ label: "Approve sale", address: registry, abi: registryAbi, functionName: "approve", args: [facility, id] });
            }
            calls.push({ label: "Sell", address: facility, abi: facilityAbi, functionName: "sell", args: [o.fid, id, o.price] });
            blocks.push(
                <div key="sell" className="f-col gap-4">
                    <div className="rounded-[10px] bg-neutral-background px-[20px] py-[10px] divide-y divide-divider-border">
                        <Row label="You receive now">
                            <span className="body-bold">
                                {formatAmount(o.price - o.fee)} {symbol}
                            </span>
                        </Row>
                        <Row label="Discount">
                            {formatAmount(d.remaining - o.price)} {symbol} at {(o.aprBps / 100).toFixed(2)}% a year
                        </Row>
                        <Row label="Protocol fee">
                            {formatAmount(o.fee)} {symbol}
                        </Row>
                    </div>
                    <ActionButton priority="primary" disabled={busy} onClick={() => run(calls)}>
                        <span className="body-bold">
                            Sell for {formatAmount(o.price - o.fee)} {symbol}
                        </span>
                    </ActionButton>
                </div>,
            );
        } else {
            blocks.push(
                <p key="nooffer" className="text-sm text-secondary-content">
                    No financier is buying this invoice right now
                    {d.noOfferReason && d.noOfferReason !== "no facilities" ? ` (${d.noOfferReason})` : ""}. You will be
                    paid on the due date, or you can check again later.
                </p>,
            );
        }
    }

    // Buyer pays all or part of what is left; the registry forwards it to whoever holds the receivable.
    if (open && isBuyer && token) {
        const input = payInput ?? formatAmount(d.remaining).replace(/,/g, "");
        let amount: bigint | undefined;
        try {
            amount = input ? parseUnits(input, token.decimals) : undefined;
        } catch {
            amount = undefined;
        }
        const tooMuch = amount !== undefined && amount > d.remaining;
        const short = amount !== undefined && d.balance !== undefined && amount > d.balance;
        const valid = amount !== undefined && amount > BigInt(0) && !tooMuch && !short;
        const calls: Call[] = [];
        if (valid && (d.allowance ?? BigInt(0)) < amount!) {
            calls.push({ label: `Approve ${symbol}`, address: token.address, abi: erc20Abi, functionName: "approve", args: [registry, amount!] });
        }
        if (valid) calls.push({ label: "Pay", address: registry, abi: registryAbi, functionName: "pay", args: [id, amount!] });

        blocks.push(
            <div key="pay" className="f-col gap-2">
                <div className="f-between-center text-sm">
                    <span className="text-tertiary-content">Pay now</span>
                    <span className="text-secondary-content">
                        Balance: {d.balance !== undefined ? formatAmount(d.balance) : "N/A"} {symbol}
                    </span>
                </div>
                <div className="relative f-row items-center h-[64px] rounded-[10px] bg-neutral-background">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={input}
                        onChange={(e) => setPayInput(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
                        className="w-full h-full input-box border-0 bg-transparent font-bold pl-[15px]"
                    />
                    <span className="f-row items-center gap-2 pr-[20px] title-subsection-bold">
                        <TokenIcon symbol={token.symbol} />
                        {symbol}
                    </span>
                </div>
                <div className="min-h-[20px] text-sm">
                    {tooMuch && <span className="text-negative-sentiment">Only {formatAmount(d.remaining)} {symbol} is left to pay.</span>}
                    {short && !tooMuch && <span className="text-negative-sentiment">Not enough {symbol} in your wallet.</span>}
                </div>
                <ActionButton priority="primary" disabled={busy || !valid} onClick={() => run(calls)}>
                    <span className="body-bold">
                        {amount === d.remaining ? "Pay in full" : "Pay"} {valid ? `${formatAmount(amount!)} ${symbol}` : ""}
                    </span>
                </ActionButton>
            </div>,
        );
    }

    // Permissionless settlement paths, available to anyone once their time has come.
    if (d.r.status === Status.Accepted && isGuaranteed && now > Number(d.r.dueDate)) {
        blocks.push(
            <ActionButton
                key="settle"
                priority="secondary"
                disabled={busy}
                onClick={() =>
                    run([{ label: "Settle", address: registry, abi: registryAbi, functionName: "settleFromGuarantee", args: [id] }])
                }>
                <span className="body-bold">Settle from the buyer&apos;s guarantee</span>
            </ActionButton>,
        );
    }
    if (d.r.status === Status.Accepted && !isGuaranteed && now > Number(d.r.dueDate) + DEFAULT_GRACE) {
        blocks.push(
            <ActionButton
                key="default"
                priority="secondary"
                disabled={busy}
                onClick={() => run([{ label: "Mark default", address: registry, abi: registryAbi, functionName: "markDefault", args: [id] }])}>
                <span className="body-bold">Mark as defaulted</span>
            </ActionButton>,
        );
    }

    if ((d.claimable ?? BigInt(0)) > BigInt(0)) {
        blocks.push(
            <ActionButton
                key="claim"
                priority="primary"
                disabled={busy}
                onClick={() => run([{ label: "Claim", address: registry, abi: registryAbi, functionName: "claim", args: [d.r.token] }])}>
                <span className="body-bold">
                    Claim {formatAmount(d.claimable!)} {symbol}
                </span>
            </ActionButton>,
        );
    }

    if (!viewer) {
        return <p className="text-sm text-secondary-content text-center">Connect your wallet to act on this invoice.</p>;
    }
    if (blocks.length === 0 && state.kind === "idle") return null;

    const explorer = state.kind === "done" ? explorerTx(state.hash) : undefined;
    return (
        <div className="f-col gap-4">
            {blocks}
            {busy && <p className="text-sm text-secondary-content text-center">{busyLabel(state)}</p>}
            {state.kind === "error" && <p className="text-sm text-negative-sentiment text-center">{state.message}</p>}
            {state.kind === "done" && (
                <p className="text-sm text-positive-sentiment text-center">
                    {state.label} confirmed.{" "}
                    {explorer && (
                        <a href={explorer} target="_blank" rel="noreferrer" className="link">
                            View transaction
                        </a>
                    )}
                </p>
            )}
        </div>
    );
}

// ---------------------------------------------------------------- page

function headline(d: Data, viewer?: Address): string {
    const isBuyer = same(viewer, d.r.buyer);
    const isSupplier = same(viewer, d.r.supplier);
    const isHolder = same(viewer, d.holder);
    const symbol = d.token?.symbol ?? "";
    switch (d.r.status) {
        case Status.Pending:
            if (isBuyer) return "Accept to confirm you owe this. The terms are then fixed and the supplier can get paid early.";
            if (isSupplier) return "Waiting for your buyer to accept. Send them the link to this page.";
            return "Waiting for the buyer to accept.";
        case Status.Accepted:
            if (isBuyer) return `Pay ${symbol} to the contract by the due date. Whoever holds the invoice is paid automatically.`;
            if (isHolder && !d.overdue) return "Accepted by the buyer. Sell it now for cash, or wait to be paid on the due date.";
            if (isHolder) return "The due date has passed. Payment goes to you as soon as the buyer pays.";
            if (isSupplier) return "You sold this invoice. The buyer now pays the new holder.";
            return "Accepted by the buyer. Payment goes to whoever holds it.";
        case Status.Paid:
            return "Paid in full.";
        case Status.Cancelled:
            return "This invoice was cancelled or rejected before it was accepted.";
        default:
            return "The buyer missed the due date by more than 30 days. It can still be paid.";
    }
}

export function Receivable({ id }: { id: bigint }) {
    const { address: viewer } = useAccount();
    const params = useSearchParams();
    const { data: d, isLoading, error, refetch } = useReceivable(id, viewer);

    if (!contracts.registry) {
        return <Card className="w-full md:w-[524px]" title={`Invoice #${id}`} text="The registry address is not configured." />;
    }
    if (isLoading) {
        return (
            <Card className="w-full md:w-[524px]" title={`Invoice #${id}`}>
                <div className="f-center py-[40px]">
                    <span className="loading loading-spinner" />
                </div>
            </Card>
        );
    }
    if (error || !d) {
        return (
            <Card
                className="w-full md:w-[524px]"
                title={`Invoice #${id}`}
                text={error ? "Could not read this invoice from the chain." : "No invoice with this number exists."}
            />
        );
    }

    const status = statusOf(d.r.status, d.overdue);
    const symbol = d.token?.symbol ?? "";
    const days = daysUntil(d.r.dueDate);
    const ref = params.get("ref");
    const refMatches = ref !== null && keccak256(toBytes(ref)) === d.r.ref;
    const hasDoc = d.r.docHash !== `0x${"0".repeat(64)}`;
    const step = d.r.status === Status.Paid ? 3 : d.r.status === Status.Pending || d.r.status === Status.Cancelled ? 0 : 1;
    const paid = d.r.paidAmount;

    return (
        <div className="gap-0 w-full md:w-[524px]">
            <Stepper>
                {["Issued", "Accepted", "Paid"].map((label, i) => (
                    <Step key={label} stepIndex={i} currentStepIndex={step} isActive={step === i}>
                        {label}
                    </Step>
                ))}
            </Stepper>

            <Card className="md:mt-[32px] w-full md:w-[524px]" title={`Invoice #${id}`} text={headline(d, viewer)}>
                <div className="mt-[30px] f-col gap-[30px]">
                    <div className="f-col items-center text-center gap-2">
                        <span className={cn("px-3 py-1 rounded-full text-sm body-bold", toneClass[status.tone])}>{status.label}</span>
                        <span className="f-row items-center gap-3 font-['Clash_Grotesk'] font-semibold text-[40px] leading-none">
                            {d.token && <TokenIcon symbol={d.token.symbol} size={32} />}
                            {formatAmount(d.r.faceAmount)} {symbol}
                        </span>
                        {paid > BigInt(0) && d.r.status !== Status.Paid && (
                            <span className="text-sm text-secondary-content">
                                {formatAmount(paid)} paid, {formatAmount(d.remaining)} left
                            </span>
                        )}
                    </div>

                    <div className="rounded-[10px] bg-neutral-background px-[20px] py-[10px] divide-y divide-divider-border">
                        <Row label="Supplier">
                            <Party address={d.r.supplier} you={same(viewer, d.r.supplier)} />
                        </Row>
                        <Row label="Buyer">
                            <Party address={d.r.buyer} you={same(viewer, d.r.buyer)} />
                        </Row>
                        {!same(d.holder, d.r.supplier) && !same(d.holder, zeroAddress) && (
                            <Row label="Held by">
                                <Party address={d.holder} you={same(viewer, d.holder)} />
                            </Row>
                        )}
                        <Row label="Due">
                            {formatDate(d.r.dueDate)}
                            {d.r.status === Status.Pending || d.r.status === Status.Accepted ? (
                                <span className={cn("text-tertiary-content", days < 0 && "text-negative-sentiment")}>
                                    {" "}
                                    ({days >= 0 ? `in ${plural(days, "day")}` : `${plural(-days, "day")} late`})
                                </span>
                            ) : null}
                        </Row>
                        {(d.r.flags & FLAG_GUARANTEED) !== 0 && (
                            <Row label="Guarantee">
                                <span className="f-row items-center gap-1 justify-end">
                                    <Icon type="check-circle" size={16} fillClass="fill-positive-sentiment" />
                                    Backed by the buyer
                                </span>
                            </Row>
                        )}
                        <Row label="Invoice number">
                            {ref === null ? (
                                <span className="text-tertiary-content">Only its fingerprint is onchain</span>
                            ) : refMatches ? (
                                <span className="f-row items-center gap-1 justify-end">
                                    <Icon type="check-circle" size={16} fillClass="fill-positive-sentiment" />
                                    {ref}
                                </span>
                            ) : (
                                <span className="text-negative-sentiment">{ref} does not match</span>
                            )}
                        </Row>
                        <Row label="Document">
                            {hasDoc ? <DocumentCheck docHash={d.r.docHash} /> : <span className="text-tertiary-content">None</span>}
                        </Row>
                    </div>

                    <ActionPanel d={d} id={id} viewer={viewer} onDone={() => refetch()} />
                </div>
            </Card>
        </div>
    );
}
