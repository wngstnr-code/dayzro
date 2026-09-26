"use client";

import Link from "next/link";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type Address, createPublicClient, custom, formatUnits, getAddress, isAddress, keccak256, parseEventLogs, parseUnits, toBytes } from "viem";
import { arc } from "viem/chains";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { registryAbi } from "@/dapp/abi/registry";
import { cn } from "@/dapp/lib/cn";
import {
    contracts,
    explorerTx,
    isLocalChain,
    MAX_TENOR_DAYS,
    MIN_FACE,
    readableError,
    type Token,
    tokens,
    ZERO_HASH,
} from "@/dapp/lib/contracts";
import { shortenAddress } from "@/dapp/lib/hooks";
import { ActionButton, StepBack } from "./Buttons";
import { Card, Step, Stepper } from "./Card";
import { Icon } from "./Icon";
import { TokenIcon } from "./TokenIcon";

type Doc = { name: string; size: number; hash: `0x${string}` };

type Draft = {
    buyer: string;
    token: Token;
    amount: string;
    dueDate: string; // yyyy-mm-dd, local time
    invoiceNo: string;
    doc?: Doc;
};

type Errors = Partial<Record<"buyer" | "amount" | "dueDate" | "invoiceNo", string>>;

type TxState =
    | { kind: "idle" }
    | { kind: "signing" }
    | { kind: "mining"; hash: `0x${string}` }
    | { kind: "done"; hash: `0x${string}`; id: bigint }
    | { kind: "error"; message: string };

const DAY = 24 * 60 * 60 * 1000;

function isoDate(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** End of the chosen local day, so "due 12 Nov" means payable through 12 Nov. */
function dueTimestamp(date: string): bigint {
    const [y, m, d] = date.split("-").map(Number);
    return BigInt(Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000));
}

function daysFromToday(date: string): number {
    const [y, m, d] = date.split("-").map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / DAY);
}

function formatDue(date: string) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function parseAmount(amount: string, token: Token): bigint | undefined {
    try {
        return amount ? parseUnits(amount, token.decimals) : undefined;
    } catch {
        return undefined;
    }
}

function validate(draft: Draft, self: Address | undefined): Errors {
    const errors: Errors = {};
    const buyer = draft.buyer.trim();
    if (!buyer) errors.buyer = "Enter the buyer's wallet address.";
    else if (!isAddress(buyer)) errors.buyer = "This is not a valid address.";
    else if (self && getAddress(buyer) === self) errors.buyer = "The buyer must be someone else.";

    const face = parseAmount(draft.amount, draft.token);
    if (!draft.amount) errors.amount = "Enter the invoice amount.";
    else if (face === undefined) errors.amount = "Use a number with up to 6 decimals.";
    else if (face < MIN_FACE) errors.amount = `The minimum is 1 ${draft.token.symbol}.`;

    if (!draft.dueDate) errors.dueDate = "Pick the date the buyer will pay.";
    else {
        const days = daysFromToday(draft.dueDate);
        if (days < 1) errors.dueDate = "The due date must be after today.";
        else if (days > MAX_TENOR_DAYS - 1) errors.dueDate = "The due date must be within a year.";
    }

    if (!draft.invoiceNo.trim()) errors.invoiceNo = "Enter your invoice or PO number.";
    return errors;
}

// ---------------------------------------------------------------- small pieces

function FieldLabel({ label, hint }: { label: string; hint?: ReactNode }) {
    return (
        <div className="f-between-center text-sm mb-[8px]">
            <span className="text-tertiary-content">{label}</span>
            {hint && <span className="text-secondary-content">{hint}</span>}
        </div>
    );
}

function FieldError({ message }: { message?: string }) {
    return (
        <div className="flex mt-[8px] min-h-[20px]">
            {message && (
                <div className="f-row items-center gap-1">
                    <Icon type="exclamation-circle" size={15} fillClass="fill-negative-sentiment" />
                    <span className="text-sm text-negative-sentiment">{message}</span>
                </div>
            )}
        </div>
    );
}

const inputClass = (error?: string) =>
    cn(
        "w-full input-box border-0 bg-neutral-background placeholder:text-tertiary-content h-[56px] px-[15px]",
        error && "error",
    );

function TokenSelect({ value, onChange }: { value: Token; onChange: (t: Token) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    return (
        <div ref={ref} className="relative h-full min-w-[151px] z-30">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="f-between-center w-full h-full px-[20px] py-[14px] input-box bg-neutral-background border-0 shadow-none outline-none !rounded-l-[0px] !rounded-r-[10px]">
                <div className="f-row items-center gap-2">
                    <TokenIcon symbol={value.symbol} />
                    <span className="title-subsection-bold text-base">{value.symbol}</span>
                </div>
                <Icon type="chevron-down" size={10} />
            </button>
            {open && (
                <ul className="absolute right-0 mt-2 w-[200px] rounded-[10px] bg-neutral-background border border-primary-border-dark p-2 shadow-lg">
                    {tokens.map((t) => (
                        <li key={t.symbol}>
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(t);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "w-full f-row items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-primary-interactive-hover",
                                    t.symbol === value.symbol && "bg-primary-interactive-hover",
                                )}>
                                <TokenIcon symbol={t.symbol} />
                                <span className="flex flex-col items-start">
                                    <span className="body-bold">{t.symbol}</span>
                                    <span className="text-xs text-tertiary-content">{t.name}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="f-between-center gap-4 py-[10px]">
            <span className="text-secondary-content shrink-0">{label}</span>
            <span className="text-right break-all">{children}</span>
        </div>
    );
}

// ---------------------------------------------------------------- steps

function DetailsStep({
    draft,
    setDraft,
    self,
    onNext,
}: {
    draft: Draft;
    setDraft: (d: Draft) => void;
    self: Address | undefined;
    onNext: () => void;
}) {
    const [submitted, setSubmitted] = useState(false);
    const [hashing, setHashing] = useState(false);
    const errors = validate(draft, self);
    const shown: Errors = submitted ? errors : {};
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

    const today = new Date();
    const min = isoDate(new Date(today.getTime() + DAY));
    const max = isoDate(new Date(today.getTime() + (MAX_TENOR_DAYS - 1) * DAY));
    const days = draft.dueDate ? daysFromToday(draft.dueDate) : undefined;

    // The file never leaves the browser: only its keccak256 goes onchain, so both sides can later prove which document was agreed.
    const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setHashing(true);
        const hash = keccak256(new Uint8Array(await file.arrayBuffer()));
        setHashing(false);
        set({ doc: { name: file.name, size: file.size, hash } });
    };

    return (
        <div className="space-y-[22px] mt-[30px]">
            <div>
                <FieldLabel label="Buyer" hint="The company that owes you" />
                <input
                    className={inputClass(shown.buyer)}
                    placeholder="0x..."
                    spellCheck={false}
                    autoComplete="off"
                    value={draft.buyer}
                    onChange={(e) => set({ buyer: e.target.value })}
                />
                <FieldError message={shown.buyer} />
            </div>

            <div>
                <FieldLabel label="Amount" />
                <div className="relative f-row h-[64px]">
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={draft.amount}
                        onChange={(e) => set({ amount: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })}
                        className={cn(
                            "w-full input-box bg-neutral-background placeholder:text-tertiary-content font-bold",
                            "min-h-[64px] pl-[15px] border-0 h-full !rounded-r-none z-20",
                            shown.amount && "error",
                        )}
                    />
                    <TokenSelect value={draft.token} onChange={(token) => set({ token })} />
                </div>
                <FieldError message={shown.amount} />
            </div>

            <div>
                <FieldLabel
                    label="Due date"
                    hint={days !== undefined && days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : undefined}
                />
                <input
                    type="date"
                    min={min}
                    max={max}
                    value={draft.dueDate}
                    onChange={(e) => set({ dueDate: e.target.value })}
                    className={cn(inputClass(shown.dueDate), "dz-date")}
                />
                <FieldError message={shown.dueDate} />
            </div>

            <div>
                <FieldLabel label="Invoice number" hint="Or PO number" />
                <input
                    className={inputClass(shown.invoiceNo)}
                    placeholder="INV-2026-0142"
                    maxLength={64}
                    value={draft.invoiceNo}
                    onChange={(e) => set({ invoiceNo: e.target.value })}
                />
                <FieldError message={shown.invoiceNo} />
            </div>

            <div>
                <FieldLabel label="Invoice document" hint="Optional" />
                {draft.doc ? (
                    <div className="f-between-center gap-3 rounded-[10px] bg-neutral-background px-[15px] h-[56px]">
                        <div className="f-row items-center gap-2 min-w-0">
                            <Icon type="check-circle" size={18} fillClass="fill-positive-sentiment" />
                            <span className="truncate">{draft.doc.name}</span>
                        </div>
                        <button type="button" onClick={() => set({ doc: undefined })} aria-label="Remove document">
                            <Icon type="x-close" size={14} />
                        </button>
                    </div>
                ) : (
                    <label className="f-center gap-2 rounded-[10px] border border-dashed border-primary-border-dark h-[56px] cursor-pointer text-secondary-content hover:border-primary-brand">
                        <Icon type="plus-circle" size={16} />
                        <span>{hashing ? "Reading file..." : "Attach PDF"}</span>
                        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
                    </label>
                )}
                <p className="text-sm text-tertiary-content mt-[8px]">
                    The file stays on your device. Only its fingerprint is stored onchain.
                </p>
            </div>

            <div className="f-col w-full gap-4">
                <div className="h-sep mt-0" />
                <ActionButton
                    priority="primary"
                    onClick={() => {
                        setSubmitted(true);
                        if (Object.keys(errors).length === 0) onNext();
                    }}>
                    <span className="body-bold">Continue</span>
                </ActionButton>
            </div>
        </div>
    );
}

function ReviewStep({ draft, onBack, onNext }: { draft: Draft; onBack: () => void; onNext: () => void }) {
    const face = parseAmount(draft.amount, draft.token) ?? BigInt(0);
    return (
        <div className="mt-[30px]">
            <div className="rounded-[10px] bg-neutral-background px-[20px] py-[10px] divide-y divide-divider-border">
                <ReviewRow label="Buyer">
                    <span title={draft.buyer}>{shortenAddress(getAddress(draft.buyer.trim()), 6, 4)}</span>
                </ReviewRow>
                <ReviewRow label="Amount">
                    <span className="f-row items-center gap-2 body-bold">
                        <TokenIcon symbol={draft.token.symbol} size={20} />
                        {Number(formatUnits(face, draft.token.decimals)).toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                        })}{" "}
                        {draft.token.symbol}
                    </span>
                </ReviewRow>
                <ReviewRow label="Due">
                    {formatDue(draft.dueDate)} ({daysFromToday(draft.dueDate)} days)
                </ReviewRow>
                <ReviewRow label="Invoice number">{draft.invoiceNo.trim()}</ReviewRow>
                <ReviewRow label="Document">{draft.doc ? draft.doc.name : "None"}</ReviewRow>
            </div>

            <div className="f-row gap-2 mt-[20px] text-sm text-secondary-content">
                <Icon type="info-circle" size={16} className="shrink-0 mt-[2px]" fillClass="fill-tertiary-content" />
                <p>
                    Your buyer accepts it onchain next. Until then it cannot be sold, and you can still cancel it.
                </p>
            </div>

            <div className="f-col w-full gap-4 mt-[30px]">
                <div className="h-sep mt-0" />
                <ActionButton priority="primary" onClick={onNext}>
                    <span className="body-bold">Continue</span>
                </ActionButton>
                <StepBack onClick={onBack}>Back</StepBack>
            </div>
        </div>
    );
}

function ConfirmStep({
    draft,
    onBack,
    onReset,
    onCreated,
}: {
    draft: Draft;
    onBack: () => void;
    onReset: () => void;
    onCreated: (id: bigint) => void;
}) {
    const { address, isConnected, chainId } = useAccount();
    const publicClient = usePublicClient({ chainId: arc.id });
    const { data: walletClient } = useWalletClient();
    const [tx, setTx] = useState<TxState>({ kind: "idle" });
    const [copied, setCopied] = useState(false);
    const busy = tx.kind === "signing" || tx.kind === "mining";

    const create = async () => {
        const registry = contracts.registry;
        if (!registry || !publicClient || !walletClient || !address) return;
        try {
            setTx({ kind: "signing" });
            if (chainId !== arc.id) await walletClient.switchChain({ id: arc.id });

            // Guard against a wallet pointed at another node: the registry must exist where the wallet sends.
            const walletNode = createPublicClient({ chain: arc, transport: custom({ request: walletClient.request }) });
            const code = await walletNode.getCode({ address: registry });
            if (!code || code === "0x") {
                setTx({
                    kind: "error",
                    message: isLocalChain
                        ? "Your wallet is not on the local fork. Add a network with RPC http://127.0.0.1:8545 and chain id 5042."
                        : "Your wallet's network does not have the Dayzro registry.",
                });
                return;
            }

            const { request } = await publicClient.simulateContract({
                account: address,
                address: registry,
                abi: registryAbi,
                functionName: "createInvoice",
                args: [
                    getAddress(draft.buyer.trim()),
                    draft.token.address,
                    parseAmount(draft.amount, draft.token)!,
                    dueTimestamp(draft.dueDate),
                    draft.doc?.hash ?? ZERO_HASH,
                    keccak256(toBytes(draft.invoiceNo.trim())),
                ],
            });
            const hash = await walletClient.writeContract(request);
            setTx({ kind: "mining", hash });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== "success") {
                setTx({ kind: "error", message: "The transaction reverted." });
                return;
            }
            const [created] = parseEventLogs({ abi: registryAbi, eventName: "InvoiceCreated", logs: receipt.logs });
            setTx({ kind: "done", hash, id: created.args.id });
            onCreated(created.args.id);
        } catch (error) {
            setTx({ kind: "error", message: readableError(error) });
        }
    };

    if (tx.kind === "done") {
        const path = `/app/r/${tx.id}`;
        const link = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
        const explorer = explorerTx(tx.hash);
        return (
            <div className="mt-[30px] f-col items-center text-center">
                <Icon type="success-dark" size={120} width={120} height={120} className="hidden dark:block" />
                <Icon type="success-light" size={120} width={120} height={120} className="dark:hidden" />

                <div className="w-full f-row mt-[24px] rounded-[10px] bg-neutral-background h-[56px] items-center pl-[15px] pr-[6px] gap-2">
                    <span className="truncate text-left flex-1">{link}</span>
                    <button
                        type="button"
                        className="btn btn-sm btn-ghost rounded-full"
                        onClick={() => {
                            navigator.clipboard.writeText(link);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        }}>
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>

                <div className="f-col w-full gap-4 mt-[30px]">
                    <div className="h-sep mt-0" />
                    <Link href={path} className="w-full">
                        <ActionButton priority="primary">
                            <span className="body-bold">Open invoice</span>
                        </ActionButton>
                    </Link>
                    <ActionButton priority="secondary" onClick={onReset}>
                        <span className="body-bold">Create another</span>
                    </ActionButton>
                    {explorer && (
                        <a href={explorer} target="_blank" rel="noreferrer" className="link f-center gap-1">
                            View transaction <Icon type="arrow-top-right" size={14} />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    const face = parseAmount(draft.amount, draft.token) ?? BigInt(0);
    const label =
        tx.kind === "signing" ? "Confirm in your wallet" : tx.kind === "mining" ? "Creating invoice" : "Create invoice";

    return (
        <div className="mt-[30px]">
            <div className="f-col items-center text-center">
                <Icon type="approve-dark" size={120} width={120} height={120} className="hidden dark:block" />
                <Icon type="approve-light" size={120} width={120} height={120} className="dark:hidden" />
                <p className="text-secondary-content mt-[16px]">
                    You are billing{" "}
                    <span className="body-bold">
                        {Number(formatUnits(face, draft.token.decimals)).toLocaleString()} {draft.token.symbol}
                    </span>{" "}
                    to {shortenAddress(getAddress(draft.buyer.trim()), 6, 4)}, due {formatDue(draft.dueDate)}. One
                    transaction, no tokens move yet.
                </p>
            </div>

            {!contracts.registry && (
                <p className="mt-[20px] text-sm text-warning-sentiment text-center">
                    The registry address is not configured. Run scripts/fork.sh deploy or set
                    NEXT_PUBLIC_REGISTRY_ADDRESS.
                </p>
            )}
            {tx.kind === "error" && (
                <p className="mt-[20px] text-sm text-negative-sentiment text-center">{tx.message}</p>
            )}

            <div className="f-col w-full gap-4 mt-[30px]">
                <div className="h-sep mt-0" />
                <ActionButton
                    priority="primary"
                    loading={busy}
                    disabled={busy || !isConnected || !contracts.registry}
                    onClick={create}>
                    <span className="body-bold">{isConnected ? label : "Connect your wallet first"}</span>
                </ActionButton>
                {!busy && <StepBack onClick={onBack}>Back</StepBack>}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- flow

const steps = ["Details", "Review", "Confirm"] as const;
const copy = [
    { title: "New invoice", text: "Bill a buyer onchain. Once they accept, you can sell it for cash today." },
    { title: "Review invoice", text: "Check the terms. They are fixed once your buyer accepts." },
    { title: "Create invoice", text: "Sign one transaction to put the invoice onchain." },
];

const emptyDraft = (): Draft => ({ buyer: "", token: tokens[0], amount: "", dueDate: "", invoiceNo: "" });

/** Supplier flow: Details, Review, Confirm. Same stepper and card as the bridge flow it replaces. */
export function CreateInvoice() {
    const { address } = useAccount();
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [createdId, setCreatedId] = useState<bigint>();
    const current = useMemo(
        () =>
            createdId === undefined
                ? copy[step]
                : {
                      title: `Invoice #${createdId} created`,
                      text: `Send this link to your buyer. Once they accept, you can sell it for ${draft.token.symbol} today.`,
                  },
        [step, createdId, draft.token.symbol],
    );

    return (
        <div className="gap-0 w-full md:w-[524px]">
            <Stepper>
                {steps.map((label, i) => (
                    <Step key={label} stepIndex={i} currentStepIndex={step} isActive={step === i}>
                        {label}
                    </Step>
                ))}
            </Stepper>

            <Card className="md:mt-[32px] w-full md:w-[524px]" title={current.title} text={current.text}>
                {step === 0 && (
                    <DetailsStep draft={draft} setDraft={setDraft} self={address} onNext={() => setStep(1)} />
                )}
                {step === 1 && <ReviewStep draft={draft} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
                {step === 2 && (
                    <ConfirmStep
                        draft={draft}
                        onBack={() => setStep(1)}
                        onCreated={setCreatedId}
                        onReset={() => {
                            setDraft(emptyDraft());
                            setCreatedId(undefined);
                            setStep(0);
                        }}
                    />
                )}
            </Card>
        </div>
    );
}
