"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { type Address, erc20Abi, getAddress, isAddress, isAddressEqual } from "viem";
import { arc } from "viem/chains";
import { useAccount, usePublicClient } from "wagmi";
import { facilityAbi } from "@/dapp/abi/facility";
import { registryAbi } from "@/dapp/abi/registry";
import { cn } from "@/dapp/lib/cn";
import { contracts, type Token, tokens } from "@/dapp/lib/contracts";
import { formatAmount } from "@/dapp/lib/format";
import { Status } from "@/dapp/lib/receivable";
import { type Call, useSendTx } from "@/dapp/lib/tx";
import { ActionButton } from "./Buttons";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { TokenIcon } from "./TokenIcon";
import { cleanNumber, Field, parseTokenAmount, Stat, Toggle, TxStatus } from "./Form";
import { TokenSelect } from "./TokenSelect";

// Mirrors DayzroFacility limits.
const MAX_APR_BPS = 5_000;
const MAX_TENOR_DAYS = 365;
const YEAR = 365 * 24 * 60 * 60;

type FacilityTerms = {
    financier: Address;
    token: Address;
    aprBps: number;
    maxTenorDays: number;
    acceptGuaranteed: boolean;
    active: boolean;
    available: bigint;
};

const tokenOf = (address: Address) => tokens.find((t) => isAddressEqual(t.address, address));

/** Same discount as DayzroFacility.quote: price = face * YEAR / (YEAR + apr * t). */
function priceFor(face: bigint, aprBps: number, days: number): bigint {
    const t = BigInt(days * 24 * 60 * 60);
    const scale = BigInt(YEAR) * BigInt(10_000);
    return (face * scale) / (scale + BigInt(aprBps) * t);
}

// ---------------------------------------------------------------- data

function useFinance(account?: Address) {
    const client = usePublicClient({ chainId: arc.id });
    const { facility, registry } = contracts;

    return useQuery({
        queryKey: ["finance", account, facility],
        enabled: !!client && !!facility && !!registry && !!account,
        refetchInterval: 20_000,
        queryFn: async () => {
            const fids = await client!.readContract({ address: facility!, abi: facilityAbi, functionName: "facilitiesOf", args: [account!] });
            const terms = await client!.multicall({
                allowFailure: false,
                contracts: fids.map((fid) => ({ address: facility!, abi: facilityAbi, functionName: "getFacility" as const, args: [fid] as const })),
            });

            const wallet = await client!.multicall({
                allowFailure: false,
                contracts: tokens.flatMap((t) => [
                    { address: t.address, abi: erc20Abi, functionName: "balanceOf" as const, args: [account!] as const },
                    { address: t.address, abi: erc20Abi, functionName: "allowance" as const, args: [account!, facility!] as const },
                ]),
            });

            // Portfolio: receivables this account holds that are still owed (bought through a facility or OTC).
            const held = await client!.readContract({ address: registry!, abi: registryAbi, functionName: "balanceOf", args: [account!] });
            const heldIds = await client!.multicall({
                allowFailure: false,
                contracts: Array.from({ length: Number(held) }, (_, i) => ({
                    address: registry!,
                    abi: registryAbi,
                    functionName: "tokenOfOwnerByIndex" as const,
                    args: [account!, BigInt(i)] as const,
                })),
            });
            const heldRows = await client!.multicall({
                allowFailure: false,
                contracts: heldIds.map((id) => ({ address: registry!, abi: registryAbi, functionName: "getReceivable" as const, args: [id] as const })),
            });
            const outstanding: Record<string, bigint> = {};
            let openCount = 0;
            for (const [r, , remaining] of heldRows) {
                if (r.status !== Status.Accepted && r.status !== Status.Defaulted) continue;
                if (isAddressEqual(r.supplier, account!)) continue;
                openCount++;
                const symbol = tokenOf(r.token)?.symbol ?? "?";
                outstanding[symbol] = (outstanding[symbol] ?? BigInt(0)) + remaining;
            }

            return {
                facilities: fids.map((fid, i) => ({ fid, f: terms[i] as FacilityTerms })),
                wallet: Object.fromEntries(
                    tokens.map((t, i) => [t.symbol, { balance: wallet[i * 2] as bigint, allowance: wallet[i * 2 + 1] as bigint }]),
                ) as Record<Token["symbol"], { balance: bigint; allowance: bigint }>,
                portfolio: { openCount, outstanding },
            };
        },
    });
}

type FinanceData = NonNullable<ReturnType<typeof useFinance>["data"]>;

// ---------------------------------------------------------------- small pieces

function termsError(apr: string, tenor: string) {
    const aprBps = Math.round(Number(apr) * 100);
    const days = Number(tenor);
    return {
        aprBps,
        days,
        apr: !apr ? "Enter a yearly rate." : !(aprBps >= 1 && aprBps <= MAX_APR_BPS) ? "Between 0.01% and 50%." : undefined,
        tenor:
            !tenor ? "Enter the longest time to due date." : !(Number.isInteger(days) && days >= 1 && days <= MAX_TENOR_DAYS) ? "Between 1 and 365 days." : undefined,
    };
}

function PricePreview({ aprBps, days, symbol }: { aprBps: number; days: number; symbol: string }) {
    const sample = Math.min(60, days);
    const face = BigInt(1_000_000_000);
    const price = priceFor(face, aprBps, sample);
    return (
        <p className="text-sm text-secondary-content">
            At this rate a 1,000 {symbol} invoice due in {sample} days is bought for{" "}
            <span className="body-bold text-[color:var(--primary-content)]">
                {formatAmount(price)} {symbol}
            </span>{" "}
            and repays you 1,000 {symbol}.
        </p>
    );
}

// ---------------------------------------------------------------- open a facility

function OpenFacility({ data, onDone, onCancel }: { data: FinanceData; onDone: () => void; onCancel?: () => void }) {
    const tx = useSendTx();
    const [token, setToken] = useState<Token>(tokens[0]);
    const [apr, setApr] = useState("10");
    const [tenor, setTenor] = useState("90");
    const [deposit, setDeposit] = useState("");
    const [acceptGuaranteed, setAcceptGuaranteed] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    const wallet = data.wallet[token.symbol];
    const amount = parseTokenAmount(deposit, token) ?? BigInt(0);
    const t = termsError(apr, tenor);
    const depositError = deposit && parseTokenAmount(deposit, token) === undefined ? "Use a number with up to 6 decimals." : amount > wallet.balance ? `Not enough ${token.symbol} in your wallet.` : undefined;
    const valid = !t.apr && !t.tenor && !depositError;

    const submit = async () => {
        setSubmitted(true);
        if (!valid) return;
        const facility = contracts.facility!;
        const calls: Call[] = [];
        if (amount > BigInt(0) && wallet.allowance < amount) {
            calls.push({ label: `Approve ${token.symbol}`, address: token.address, abi: erc20Abi, functionName: "approve", args: [facility, amount] });
        }
        calls.push({
            label: "Open facility",
            address: facility,
            abi: facilityAbi,
            functionName: "open",
            args: [token.address, t.aprBps, t.days, acceptGuaranteed, amount],
        });
        if (await tx.send(calls)) onDone();
    };

    return (
        <div className="rounded-[16px] border border-divider-border p-[20px] md:p-[28px] f-col gap-[6px]">
            <h3 className="title-body-bold mb-[14px]">Open a facility</h3>
            <div className="grid md:grid-cols-2 gap-x-[20px]">
                <Field label="Yearly rate" suffix="% a year" value={apr} onChange={(v) => setApr(cleanNumber(v))} error={submitted ? t.apr : undefined} />
                <Field
                    label="Longest time to due date"
                    suffix="days"
                    value={tenor}
                    onChange={(v) => setTenor(v.replace(/\D/g, ""))}
                    error={submitted ? t.tenor : undefined}
                />
            </div>
            <Field
                label="Deposit"
                hint={`Balance: ${formatAmount(wallet.balance)} ${token.symbol}`}
                value={deposit}
                placeholder="0.00"
                onChange={(v) => setDeposit(cleanNumber(v))}
                error={depositError}
                right={
                    <div className="h-full min-w-[151px]">
                        <TokenSelect value={token} onChange={setToken} />
                    </div>
                }
            />
            <Toggle checked={acceptGuaranteed} onChange={setAcceptGuaranteed}>
                Buy invoices the buyer backed with a guarantee, from any buyer. Invoices without a guarantee are only bought from
                buyers you give a limit to.
            </Toggle>
            {!t.apr && !t.tenor && (
                <div className="mt-[14px]">
                    <PricePreview aprBps={t.aprBps} days={t.days} symbol={token.symbol} />
                </div>
            )}
            <div className="f-col gap-3 mt-[20px]">
                <ActionButton priority="primary" loading={tx.busy} disabled={tx.busy} onClick={submit}>
                    <span className="body-bold">{amount > BigInt(0) ? `Open with ${formatAmount(amount)} ${token.symbol}` : "Open facility"}</span>
                </ActionButton>
                {onCancel && !tx.busy && (
                    <button className="link self-center" onClick={onCancel}>
                        Cancel
                    </button>
                )}
                <TxStatus tx={tx} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- manage one facility

type Tab = "fund" | "withdraw" | "terms" | "limits";

function FacilityPanel({ fid, f, data, onDone }: { fid: bigint; f: FacilityTerms; data: FinanceData; onDone: () => void }) {
    const tx = useSendTx();
    const client = usePublicClient({ chainId: arc.id });
    const { address: account } = useAccount();
    const token = tokenOf(f.token)!;
    const wallet = data.wallet[token.symbol];
    const facility = contracts.facility!;

    const [tab, setTab] = useState<Tab>("fund");
    const [amountInput, setAmountInput] = useState("");
    const [apr, setApr] = useState((f.aprBps / 100).toString());
    const [tenor, setTenor] = useState(f.maxTenorDays.toString());
    const [acceptGuaranteed, setAcceptGuaranteed] = useState(f.acceptGuaranteed);
    const [active, setActive] = useState(f.active);
    const [buyer, setBuyer] = useState("");
    const [capInput, setCapInput] = useState("");

    const amount = parseTokenAmount(amountInput, token);
    const run = async (calls: Call[]) => {
        if (await tx.send(calls)) {
            setAmountInput("");
            onDone();
        }
    };

    const buyerAddress = isAddress(buyer.trim()) ? getAddress(buyer.trim()) : undefined;
    const limit = useQuery({
        queryKey: ["buyerCap", fid.toString(), buyerAddress],
        enabled: !!client && !!buyerAddress && !!account,
        queryFn: async () => {
            const [cap, exposure] = await client!.multicall({
                allowFailure: false,
                contracts: [
                    { address: facility, abi: facilityAbi, functionName: "buyerCap", args: [fid, buyerAddress!] },
                    { address: contracts.registry!, abi: registryAbi, functionName: "exposure", args: [account!, buyerAddress!, f.token] },
                ],
            });
            return { cap, exposure };
        },
    });

    const tabs: { id: Tab; label: string }[] = [
        { id: "fund", label: "Add funds" },
        { id: "withdraw", label: "Withdraw" },
        { id: "terms", label: "Terms" },
        { id: "limits", label: "Buyer limits" },
    ];

    let body: ReactNode;
    if (tab === "fund" || tab === "withdraw") {
        const max = tab === "fund" ? wallet.balance : f.available;
        const error =
            amountInput && amount === undefined
                ? "Use a number with up to 6 decimals."
                : amount !== undefined && amount > max
                  ? tab === "fund"
                      ? `Not enough ${token.symbol} in your wallet.`
                      : "More than the facility holds."
                  : undefined;
        const valid = amount !== undefined && amount > BigInt(0) && !error;
        const calls: Call[] = [];
        if (valid && tab === "fund" && wallet.allowance < amount!) {
            calls.push({ label: `Approve ${token.symbol}`, address: token.address, abi: erc20Abi, functionName: "approve", args: [facility, amount!] });
        }
        if (valid) calls.push({ label: tab === "fund" ? "Add funds" : "Withdraw", address: facility, abi: facilityAbi, functionName: tab, args: [fid, amount!] });
        body = (
            <>
                <Field
                    label="Amount"
                    hint={
                        <button className="hover:underline" onClick={() => setAmountInput(formatAmount(max).replace(/,/g, ""))}>
                            {tab === "fund" ? "Wallet" : "Available"}: {formatAmount(max)} {token.symbol}
                        </button>
                    }
                    value={amountInput}
                    placeholder="0.00"
                    onChange={(v) => setAmountInput(cleanNumber(v))}
                    error={error}
                    suffix={
                        <span className="f-row items-center gap-2 title-subsection-bold text-[color:var(--primary-content)]">
                            <TokenIcon symbol={token.symbol} /> {token.symbol}
                        </span>
                    }
                />
                <ActionButton priority="primary" loading={tx.busy} disabled={tx.busy || !valid} onClick={() => run(calls)}>
                    <span className="body-bold">
                        {tab === "fund" ? "Add" : "Withdraw"} {valid ? `${formatAmount(amount!)} ${token.symbol}` : ""}
                    </span>
                </ActionButton>
            </>
        );
    } else if (tab === "terms") {
        const t = termsError(apr, tenor);
        const unchanged =
            t.aprBps === f.aprBps && t.days === f.maxTenorDays && acceptGuaranteed === f.acceptGuaranteed && active === f.active;
        body = (
            <>
                <div className="grid md:grid-cols-2 gap-x-[20px]">
                    <Field label="Yearly rate" suffix="% a year" value={apr} onChange={(v) => setApr(cleanNumber(v))} error={t.apr} />
                    <Field label="Longest time to due date" suffix="days" value={tenor} onChange={(v) => setTenor(v.replace(/\D/g, ""))} error={t.tenor} />
                </div>
                <div className="f-col gap-3 mb-[10px]">
                    <Toggle checked={acceptGuaranteed} onChange={setAcceptGuaranteed}>
                        Buy guaranteed invoices from any buyer
                    </Toggle>
                    <Toggle checked={active} onChange={setActive}>
                        Open for sales (turn off to pause buying)
                    </Toggle>
                </div>
                {!t.apr && !t.tenor && <PricePreview aprBps={t.aprBps} days={t.days} symbol={token.symbol} />}
                <ActionButton
                    priority="primary"
                    loading={tx.busy}
                    disabled={tx.busy || !!t.apr || !!t.tenor || unchanged}
                    onClick={() =>
                        run([
                            {
                                label: "Save terms",
                                address: facility,
                                abi: facilityAbi,
                                functionName: "setTerms",
                                args: [fid, t.aprBps, t.days, acceptGuaranteed, active],
                            },
                        ])
                    }>
                    <span className="body-bold">Save terms</span>
                </ActionButton>
            </>
        );
    } else {
        const cap = parseTokenAmount(capInput, token);
        body = (
            <>
                <p className="text-sm text-secondary-content">
                    How much you are willing to be owed by one buyer on invoices without a guarantee. It frees up as they pay.
                </p>
                <div>
                    <div className="text-sm text-tertiary-content mb-[8px]">Buyer</div>
                    <input
                        className="w-full input-box border-0 bg-neutral-background h-[56px] px-[15px] placeholder:text-tertiary-content"
                        placeholder="0x..."
                        spellCheck={false}
                        value={buyer}
                        onChange={(e) => setBuyer(e.target.value)}
                    />
                    <div className="min-h-[20px] mt-[6px] text-sm">
                        {buyer && !buyerAddress && <span className="text-negative-sentiment">This is not a valid address.</span>}
                        {limit.data && (
                            <span className="text-secondary-content">
                                Current limit {formatAmount(limit.data.cap)} {token.symbol}, you are owed {formatAmount(limit.data.exposure)}{" "}
                                {token.symbol} by them now.
                            </span>
                        )}
                    </div>
                </div>
                <Field
                    label="New limit"
                    value={capInput}
                    placeholder="0.00"
                    onChange={(v) => setCapInput(cleanNumber(v))}
                    error={capInput && cap === undefined ? "Use a number with up to 6 decimals." : undefined}
                    suffix={token.symbol}
                />
                <ActionButton
                    priority="primary"
                    loading={tx.busy}
                    disabled={tx.busy || !buyerAddress || cap === undefined}
                    onClick={async () => {
                        await run([{ label: "Set limit", address: facility, abi: facilityAbi, functionName: "setBuyerCap", args: [fid, buyerAddress!, cap!] }]);
                        limit.refetch();
                    }}>
                    <span className="body-bold">Set limit</span>
                </ActionButton>
            </>
        );
    }

    return (
        <div className="pt-[6px] pb-[20px] f-col gap-[14px]">
            <div className="f-row flex-wrap gap-2">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => {
                            setTab(t.id);
                            tx.reset();
                        }}
                        className={cn(tab === t.id ? "btn-primary text-white" : "btn-ghost", "btn btn-sm h-[36px] min-h-[36px] px-[18px] rounded-full")}>
                        {t.label}
                    </button>
                ))}
            </div>
            {body}
            <TxStatus tx={tx} />
        </div>
    );
}

// ---------------------------------------------------------------- page

export function Finance() {
    const { address } = useAccount();
    const { data, isLoading, error, refetch } = useFinance(address);
    const [openForm, setOpenForm] = useState(false);
    const [expanded, setExpanded] = useState<string>();

    const title = "Finance";
    const text = "Fund a facility in USDC or EURC. Suppliers sell accepted invoices into it at your rate, and buyers repay you on the due date.";

    if (!contracts.facility || !contracts.registry) return <Card className="w-full md:w-[760px]" title={title} text="The facility address is not configured." />;
    if (!address) return <Card className="w-full md:w-[760px]" title={title} text={text}><p className="mt-[30px] text-secondary-content text-center">Connect your wallet to manage your facilities.</p></Card>;
    if (isLoading || !data) {
        return (
            <Card className="w-full md:w-[760px]" title={title} text={text}>
                <div className="f-center py-[40px]">{error ? <span className="text-secondary-content">Could not read your facilities from the chain.</span> : <span className="loading loading-spinner" />}</div>
            </Card>
        );
    }

    const available: Record<string, bigint> = {};
    for (const { f } of data.facilities) {
        const s = tokenOf(f.token)?.symbol ?? "?";
        available[s] = (available[s] ?? BigInt(0)) + f.available;
    }
    const sums = (m: Record<string, bigint>) =>
        Object.keys(m).length === 0 ? "0 USDC" : Object.entries(m).map(([s, v]) => `${formatAmount(v)} ${s}`).join(" + ");

    return (
        <Card className="w-full md:w-[760px]" title={title} text={text}>
            <div className="mt-[30px] f-col gap-[30px]">
                <div className="grid md:grid-cols-3 gap-[12px]">
                    <Stat label="Ready to buy invoices">{sums(available)}</Stat>
                    <Stat label="Owed to you">{sums(data.portfolio.outstanding)}</Stat>
                    <Stat label="Invoices bought, open">{data.portfolio.openCount}</Stat>
                </div>

                {data.facilities.length === 0 ? (
                    <OpenFacility data={data} onDone={() => refetch()} />
                ) : (
                    <div className="f-col gap-[14px]">
                        <div className="f-between-center">
                            <h3 className="title-body-bold">Your facilities</h3>
                            {!openForm && (
                                <button className="btn btn-ghost btn-sm h-[36px] min-h-[36px] px-[18px] rounded-full" onClick={() => setOpenForm(true)}>
                                    <Icon type="plus-circle" size={16} /> Open another
                                </button>
                            )}
                        </div>
                        {openForm && (
                            <OpenFacility
                                data={data}
                                onCancel={() => setOpenForm(false)}
                                onDone={() => {
                                    setOpenForm(false);
                                    refetch();
                                }}
                            />
                        )}
                        <ul className="f-col divide-y divide-divider-border">
                            {data.facilities
                                .slice()
                                .reverse()
                                .map(({ fid, f }) => {
                                    const token = tokenOf(f.token);
                                    const key = fid.toString();
                                    const isOpen = expanded === key;
                                    return (
                                        <li key={key}>
                                            <button
                                                className="w-full grid grid-cols-[1fr_auto] md:grid-cols-[64px_1fr_auto_auto] items-center gap-x-4 gap-y-1 px-3 py-[14px] -mx-3 rounded-[10px] hover:bg-primary-interactive-hover text-left"
                                                onClick={() => setExpanded(isOpen ? undefined : key)}>
                                                <span className="body-bold text-secondary-content hidden md:block">#{key}</span>
                                                <span>
                                                    <span className="body-bold">{(f.aprBps / 100).toFixed(2)}% a year</span>
                                                    <span className="block text-sm text-tertiary-content">
                                                        Up to {f.maxTenorDays} days{f.acceptGuaranteed ? ", guaranteed invoices from any buyer" : ""}
                                                    </span>
                                                </span>
                                                <span className="f-row items-center gap-2 justify-end body-bold">
                                                    {token && <TokenIcon symbol={token.symbol} size={20} />}
                                                    {formatAmount(f.available)} {token?.symbol}
                                                </span>
                                                <span className="col-span-2 md:col-span-1 f-row items-center gap-3 justify-self-start md:justify-self-end">
                                                    <span
                                                        className={cn(
                                                            "px-3 py-1 rounded-full text-xs body-bold",
                                                            f.active ? "bg-positive-background text-positive-sentiment" : "bg-neutral-background text-secondary-content",
                                                        )}>
                                                        {f.active ? "Buying" : "Paused"}
                                                    </span>
                                                    <Icon type="chevron-down" size={10} className={cn("transition-transform", isOpen && "rotate-180")} />
                                                </span>
                                            </button>
                                            {isOpen && <FacilityPanel fid={fid} f={f} data={data} onDone={() => refetch()} />}
                                        </li>
                                    );
                                })}
                        </ul>
                    </div>
                )}
            </div>
        </Card>
    );
}
