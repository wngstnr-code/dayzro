"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { type Address, erc20Abi, getAddress, isAddress, isAddressEqual } from "viem";
import { arc } from "viem/chains";
import { useAccount, usePublicClient } from "wagmi";
import { registryAbi } from "@/dapp/abi/registry";
import { cn } from "@/dapp/lib/cn";
import { contracts, type Token, tokens } from "@/dapp/lib/contracts";
import { formatAmount, formatDate } from "@/dapp/lib/format";
import { shortenAddress } from "@/dapp/lib/hooks";
import { statusOf, toneClass } from "@/dapp/lib/receivable";
import { type Call, useSendTx } from "@/dapp/lib/tx";
import { ActionButton } from "./Buttons";
import { Card } from "./Card";
import { cleanNumber, Field, parseTokenAmount, Stat, TxStatus } from "./Form";
import { Icon } from "./Icon";
import { TokenIcon } from "./TokenIcon";

const RECENT = 8;

// ---------------------------------------------------------------- data

function useProfile(buyer: Address, token: Token, viewer?: Address) {
    const client = usePublicClient({ chainId: arc.id });
    const registry = contracts.registry;

    return useQuery({
        queryKey: ["profile", buyer, token.symbol, viewer, registry],
        enabled: !!client && !!registry,
        refetchInterval: 20_000,
        queryFn: async () => {
            const [profile, stats, guarantee, count, wallet, allowance] = await client!.multicall({
                allowFailure: false,
                contracts: [
                    { address: registry!, abi: registryAbi, functionName: "profileOf", args: [buyer] },
                    { address: registry!, abi: registryAbi, functionName: "buyerStats", args: [buyer, token.address] },
                    { address: registry!, abi: registryAbi, functionName: "guaranteeOf", args: [buyer, token.address] },
                    { address: registry!, abi: registryAbi, functionName: "countByBuyer", args: [buyer] },
                    { address: token.address, abi: erc20Abi, functionName: "balanceOf", args: [viewer ?? buyer] },
                    { address: token.address, abi: erc20Abi, functionName: "allowance", args: [viewer ?? buyer, registry!] },
                ],
            });

            // Latest invoices this buyer owes, newest first (the per-buyer id list is append-only).
            const offset = count > BigInt(RECENT) ? count - BigInt(RECENT) : BigInt(0);
            const ids = await client!.readContract({
                address: registry!,
                abi: registryAbi,
                functionName: "idsByBuyer",
                args: [buyer, offset, BigInt(RECENT)],
            });
            const rows = await client!.multicall({
                allowFailure: false,
                contracts: ids.map((id) => ({ address: registry!, abi: registryAbi, functionName: "getReceivable" as const, args: [id] as const })),
            });

            return {
                name: profile[0],
                domain: profile[1],
                stats,
                guarantee: { balance: guarantee[0], locked: guarantee[1] },
                count,
                wallet,
                allowance,
                recent: ids
                    .map((id, i) => ({ id, r: rows[i][0], overdue: rows[i][1] }))
                    .reverse(),
            };
        },
    });
}

/**
 * Domain check without a server: the buyer publishes a TXT record `_dayzro.<domain>` with
 * `dayzro=<address>`, and the browser reads it over DNS-over-HTTPS.
 */
function useDomainCheck(domain: string, address: Address) {
    return useQuery({
        queryKey: ["domain", domain, address],
        enabled: !!domain,
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const res = await fetch(`https://cloudflare-dns.com/dns-query?name=_dayzro.${encodeURIComponent(domain)}&type=TXT`, {
                headers: { accept: "application/dns-json" },
            });
            const json = (await res.json()) as { Answer?: { data: string }[] };
            const expected = `dayzro=${address.toLowerCase()}`;
            return (json.Answer ?? []).some((a) => a.data.replace(/"/g, "").trim().toLowerCase() === expected);
        },
    });
}

// ---------------------------------------------------------------- pieces

function Lookup({ initial }: { initial?: string }) {
    const router = useRouter();
    const [value, setValue] = useState(initial ?? "");
    const valid = isAddress(value.trim());
    return (
        <form
            className="f-row gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                if (valid) router.push(`/app/b/${getAddress(value.trim())}`);
            }}>
            <input
                className="flex-1 min-w-0 input-box border-0 bg-neutral-background h-[48px] px-[15px] placeholder:text-tertiary-content"
                placeholder="Look up a buyer: 0x..."
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
            />
            <button type="submit" disabled={!valid} className="btn btn-primary text-white h-[48px] min-h-[48px] px-[24px] rounded-full disabled:opacity-50">
                <Icon type="magnifier" size={16} fillClass="fill-white" />
                Look up
            </button>
        </form>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="f-col gap-[14px]">
            <h3 className="title-body-bold">{title}</h3>
            {children}
        </div>
    );
}

// ---------------------------------------------------------------- own profile

function EditProfile({ name, domain, address, onDone }: { name: string; domain: string; address: Address; onDone: () => void }) {
    const tx = useSendTx();
    const [n, setN] = useState(name);
    const [d, setD] = useState(domain);
    useEffect(() => {
        setN(name);
        setD(domain);
    }, [name, domain]);
    const cleanDomain = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const tooLong = n.length > 64 || cleanDomain.length > 128;
    const unchanged = n.trim() === name && cleanDomain === domain;

    return (
        <div className="f-col gap-[6px]">
            <div className="grid md:grid-cols-2 gap-x-[20px]">
                <TextField label="Company name" value={n} onChange={setN} placeholder="Acme Trading Ltd" />
                <TextField label="Website domain" value={d} onChange={setD} placeholder="acme.com" />
            </div>
            {cleanDomain && (
                <p className="text-sm text-secondary-content mb-[10px]">
                    To verify the domain, add a TXT record named <code className="body-bold">_dayzro.{cleanDomain}</code> with the value{" "}
                    <code className="body-bold break-all">dayzro={address.toLowerCase()}</code>.
                </p>
            )}
            <ActionButton
                priority="primary"
                loading={tx.busy}
                disabled={tx.busy || tooLong || unchanged}
                onClick={async () => {
                    const calls: Call[] = [
                        { label: "Save profile", address: contracts.registry!, abi: registryAbi, functionName: "setProfile", args: [n.trim(), cleanDomain] },
                    ];
                    if (await tx.send(calls)) onDone();
                }}>
                <span className="body-bold">Save profile</span>
            </ActionButton>
            <TxStatus tx={tx} />
        </div>
    );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div className="mb-[14px]">
            <div className="text-sm text-tertiary-content mb-[8px]">{label}</div>
            <input
                className="w-full input-box border-0 bg-neutral-background h-[56px] px-[15px] placeholder:text-tertiary-content"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

function ManageGuarantee({
    token,
    guarantee,
    wallet,
    allowance,
    onDone,
}: {
    token: Token;
    guarantee: { balance: bigint; locked: bigint };
    wallet: bigint;
    allowance: bigint;
    onDone: () => void;
}) {
    const tx = useSendTx();
    const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
    const [input, setInput] = useState("");
    const free = guarantee.balance - guarantee.locked;
    const max = mode === "deposit" ? wallet : free;
    const amount = parseTokenAmount(input, token);
    const error =
        input && amount === undefined
            ? "Use a number with up to 6 decimals."
            : amount !== undefined && amount > max
              ? mode === "deposit"
                  ? `Not enough ${token.symbol} in your wallet.`
                  : "More than the unlocked part of your guarantee."
              : undefined;
    const valid = amount !== undefined && amount > BigInt(0) && !error;
    const registry = contracts.registry!;

    const calls: Call[] = [];
    if (valid && mode === "deposit" && allowance < amount!) {
        calls.push({ label: `Approve ${token.symbol}`, address: token.address, abi: erc20Abi, functionName: "approve", args: [registry, amount!] });
    }
    if (valid) {
        calls.push({
            label: mode === "deposit" ? "Deposit" : "Withdraw",
            address: registry,
            abi: registryAbi,
            functionName: mode === "deposit" ? "depositGuarantee" : "withdrawGuarantee",
            args: [token.address, amount!],
        });
    }

    return (
        <div className="f-col gap-[14px]">
            <p className="text-sm text-secondary-content">
                Money you set aside so suppliers can offer your invoices as guaranteed: they sell at better rates, and on the due date the
                invoice is paid from it if you have not paid. {formatAmount(guarantee.locked)} {token.symbol} is locked behind open invoices.
            </p>
            <div className="f-row gap-2">
                {(["deposit", "withdraw"] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => {
                            setMode(m);
                            tx.reset();
                        }}
                        className={cn(mode === m ? "btn-primary text-white" : "btn-ghost", "btn btn-sm h-[36px] min-h-[36px] px-[18px] rounded-full")}>
                        {m === "deposit" ? "Deposit" : "Withdraw"}
                    </button>
                ))}
            </div>
            <Field
                label="Amount"
                hint={
                    <button className="hover:underline" onClick={() => setInput(formatAmount(max).replace(/,/g, ""))}>
                        {mode === "deposit" ? "Wallet" : "Unlocked"}: {formatAmount(max)} {token.symbol}
                    </button>
                }
                value={input}
                placeholder="0.00"
                onChange={(v) => setInput(cleanNumber(v))}
                error={error}
                suffix={
                    <span className="f-row items-center gap-2 title-subsection-bold text-[color:var(--primary-content)]">
                        <TokenIcon symbol={token.symbol} /> {token.symbol}
                    </span>
                }
            />
            <ActionButton
                priority="primary"
                loading={tx.busy}
                disabled={tx.busy || !valid}
                onClick={async () => {
                    if (await tx.send(calls)) {
                        setInput("");
                        onDone();
                    }
                }}>
                <span className="body-bold">
                    {mode === "deposit" ? "Deposit" : "Withdraw"} {valid ? `${formatAmount(amount!)} ${token.symbol}` : ""}
                </span>
            </ActionButton>
            <TxStatus tx={tx} />
        </div>
    );
}

// ---------------------------------------------------------------- page

export function BuyerProfile({ address }: { address?: Address }) {
    const { address: viewer } = useAccount();
    const buyer = address ?? viewer;

    if (!contracts.registry) return <Card className="w-full md:w-[760px]" title="Buyer profile" text="The registry address is not configured." />;
    if (!buyer) {
        return (
            <Card
                className="w-full md:w-[760px]"
                title="Buyer profile"
                text="A buyer's payment record on Arc: invoices accepted, paid on time, paid late and defaults. Anyone can check it before financing.">
                <div className="mt-[30px]">
                    <Lookup />
                </div>
            </Card>
        );
    }
    return <ProfileView buyer={buyer} viewer={viewer} />;
}

function ProfileView({ buyer, viewer }: { buyer: Address; viewer?: Address }) {
    const [token, setToken] = useState<Token>(tokens[0]);
    const { data, isLoading, error, refetch } = useProfile(buyer, token, viewer);
    const domain = useDomainCheck(data?.domain ?? "", buyer);
    const isSelf = !!viewer && isAddressEqual(viewer, buyer);

    const header = (
        <div className="f-col gap-[20px]">
            <Lookup />
            <div className="f-row flex-wrap items-center gap-2 text-sm">
                <span className="text-secondary-content break-all">{buyer}</span>
                {isSelf && <span className="px-3 py-1 rounded-full bg-neutral-background text-secondary-content body-bold text-xs">You</span>}
                {data?.domain &&
                    (domain.data ? (
                        <span className="f-row items-center gap-1 px-3 py-1 rounded-full bg-positive-background text-positive-sentiment body-bold text-xs">
                            <Icon type="check-circle" size={14} fillClass="fill-positive-sentiment" /> {data.domain} verified
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full bg-neutral-background text-secondary-content body-bold text-xs">
                            {domain.isLoading ? `Checking ${data.domain}` : `${data.domain} not verified`}
                        </span>
                    ))}
            </div>
        </div>
    );

    const title = data?.name || (isSelf ? "Your buyer profile" : `Buyer ${shortenAddress(buyer, 6, 4)}`);
    const text = "Payment record on Arc, read from the registry. It updates itself as invoices are accepted, paid or defaulted.";

    if (isLoading || !data) {
        return (
            <Card className="w-full md:w-[760px]" title={title} text={text}>
                <div className="mt-[30px] f-col gap-[30px]">
                    {header}
                    <div className="f-center py-[30px]">
                        {error ? <span className="text-secondary-content">Could not read this profile from the chain.</span> : <span className="loading loading-spinner" />}
                    </div>
                </div>
            </Card>
        );
    }

    const s = data.stats;
    const settled = s.paidOnTime + s.paidLate;
    const onTimeRate = settled > 0 ? Math.round((s.paidOnTime / settled) * 100) : undefined;
    const avgLate = s.paidLate > 0 ? Number(s.totalDaysLate) / s.paidLate : 0;
    const symbol = token.symbol;

    return (
        <Card className="w-full md:w-[760px]" title={title} text={text}>
            <div className="mt-[30px] f-col gap-[30px]">
                {header}

                <Section title="Payment record">
                    <div className="f-row gap-2">
                        {tokens.map((t) => (
                            <button
                                key={t.symbol}
                                onClick={() => setToken(t)}
                                className={cn(token.symbol === t.symbol ? "btn-primary text-white" : "btn-ghost", "btn btn-sm h-[36px] min-h-[36px] px-[18px] rounded-full")}>
                                <TokenIcon symbol={t.symbol} size={18} /> {t.symbol}
                            </button>
                        ))}
                    </div>
                    {s.accepted === 0 ? (
                        <p className="text-secondary-content py-[10px]">No accepted invoices in {symbol} yet.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px]">
                                <Stat label="Accepted">{s.accepted}</Stat>
                                <Stat label="Paid on time">{onTimeRate === undefined ? "None settled" : `${onTimeRate}% (${s.paidOnTime})`}</Stat>
                                <Stat label="Paid late">
                                    {s.paidLate}
                                    {s.paidLate > 0 && <span className="text-sm text-tertiary-content font-normal"> avg {avgLate.toFixed(1)} days</span>}
                                </Stat>
                                <Stat label="Defaults">{s.defaults}</Stat>
                            </div>
                            <div className="grid md:grid-cols-3 gap-[12px]">
                                <Stat label="Accepted volume">
                                    {formatAmount(s.acceptedVolume)} {symbol}
                                </Stat>
                                <Stat label="Paid volume">
                                    {formatAmount(s.paidVolume)} {symbol}
                                </Stat>
                                <Stat label="Owed now">
                                    {formatAmount(s.outstanding)} {symbol}
                                </Stat>
                            </div>
                        </>
                    )}
                    <div className="grid md:grid-cols-2 gap-[12px]">
                        <Stat label="Guarantee set aside">
                            {formatAmount(data.guarantee.balance)} {symbol}
                        </Stat>
                        <Stat label="Of which locked by open invoices">
                            {formatAmount(data.guarantee.locked)} {symbol}
                        </Stat>
                    </div>
                </Section>

                {data.recent.length > 0 && (
                    <Section title={Number(data.count) > RECENT ? `Latest invoices (${RECENT} of ${data.count})` : "Invoices"}>
                        <ul className="f-col divide-y divide-divider-border">
                            {data.recent.map(({ id, r, overdue }) => {
                                const status = statusOf(r.status, overdue);
                                const t = tokens.find((x) => isAddressEqual(x.address, r.token));
                                return (
                                    <li key={id.toString()}>
                                        <Link
                                            href={`/app/r/${id}`}
                                            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-[12px] -mx-3 rounded-[10px] hover:bg-primary-interactive-hover">
                                            <span>
                                                <span className="body-bold">#{id.toString()}</span>
                                                <span className="text-sm text-tertiary-content"> due {formatDate(r.dueDate)}</span>
                                            </span>
                                            <span className="body-bold">
                                                {formatAmount(r.faceAmount)} {t?.symbol}
                                            </span>
                                            <span className={cn("px-3 py-1 rounded-full text-xs body-bold whitespace-nowrap", toneClass[status.tone])}>{status.label}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </Section>
                )}

                {isSelf && (
                    <>
                        <Section title="Your public profile">
                            <EditProfile name={data.name} domain={data.domain} address={buyer} onDone={() => refetch()} />
                        </Section>
                        <Section title={`Your ${symbol} guarantee`}>
                            <ManageGuarantee token={token} guarantee={data.guarantee} wallet={data.wallet} allowance={data.allowance} onDone={() => refetch()} />
                        </Section>
                    </>
                )}
            </div>
        </Card>
    );
}
