"use client";

import { useAccount } from "wagmi";
import { cn } from "@/dapp/lib/cn";
import { ActionButton } from "./Buttons";
import { Card, Step, Stepper } from "./Card";
import { Icon } from "./Icon";

/**
 * TEMPORARY: static replica of the reference bridge "Import" step, used only to verify the port
 * is pixel-identical to the original. It is replaced by the Dayzro invoice flows next.
 */
export function BridgeReplica() {
    const { isConnected } = useAccount();
    const disabled = !isConnected;
    const activeStep = 0;

    const selectClasses = cn(
        "select bg-transparent appearance-none w-full py-[12px] px-[15px] focus:border-transparent focus:outline-none focus:bg-primary-background-hover",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
    );

    return (
        <div className="gap-0 w-full md:w-[524px]">
            <Stepper>
                <Step stepIndex={0} currentStepIndex={activeStep} isActive={activeStep === 0}>
                    Import
                </Step>
                <Step stepIndex={1} currentStepIndex={activeStep} isActive={false}>
                    Review
                </Step>
                <Step stepIndex={2} currentStepIndex={activeStep} isActive={false}>
                    Confirm
                </Step>
            </Stepper>

            <Card className="md:mt-[32px] w-full md:w-[524px]" title="Bridge Token" text="Send your assets across chains">
                <div className="space-y-[30px] mt-[30px]">
                    {/* Combined chain selector */}
                    <div className="rounded-[10px] f-col w-full relative bg-neutral-background">
                        <div className="relative">
                            <button className={selectClasses}>
                                <span className="text-base text-secondary-content">Select Source Chain</span>
                            </button>
                        </div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                            <div className="bg-neutral-background border-[1px] border-primary-border-dark h-6 w-6 rounded-full flex items-center justify-center">
                                <button className="f-center rounded-full w-[30px] h-[30px]" disabled>
                                    <Icon type="up-down" size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="relative border-t-[1px] border-primary-border-dark">
                            <button className={selectClasses}>
                                <span className="text-base text-secondary-content">Select Destination Chain</span>
                            </button>
                        </div>
                    </div>

                    {/* Token input */}
                    <div className="TokenInput space-y-[8px]">
                        <div className="f-between-center text-sm">
                            <span className="text-tertiary-content">Amount</span>
                            <span className="text-secondary-content">Balance: N/A</span>
                        </div>
                        <div className="relative f-row h-[64px]">
                            <div className="relative f-items-center w-full">
                                <input
                                    type="number"
                                    placeholder="0.01"
                                    min="0"
                                    disabled={disabled}
                                    className={cn(
                                        "w-full input-box bg-neutral-background placeholder:text-tertiary-content font-bold",
                                        disabled ? "cursor-not-allowed" : "cursor-pointer",
                                        "min-h-[64px] pl-[15px] w-full border-0 h-full !rounded-r-none z-20",
                                    )}
                                />
                                <div className="border-l border-r bg-primary-border-dark border-neutral-background h-[64px] w-[3px]" />
                                <button
                                    disabled={disabled}
                                    className="max-button absolute right-6 uppercase hover:font-bold text-tertiary-content z-20">
                                    Max
                                </button>
                            </div>
                            <div className="relative h-full min-w-[151px] z-20">
                                <button
                                    disabled={disabled}
                                    className="f-between-center w-full h-full px-[20px] py-[14px] input-box bg-neutral-background border-0 shadow-none outline-none !rounded-l-[0px] !rounded-r-[10px]">
                                    <div className="space-x-2">
                                        <span className="title-subsection-bold text-base text-secondary-content">
                                            Select token
                                        </span>
                                    </div>
                                    {!disabled && <Icon type="chevron-down" size={10} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex mt-[8px] min-h-[24px]">
                            <div className="f-row items-center gap-1">
                                <Icon type="info-circle" size={15} fillClass="fill-tertiary-content" />
                                <span className="text-sm text-tertiary-content">
                                    incl. fees ~ <span className="text-tertiary-content mt-[4px]">0 ETH</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Step navigation */}
                    <div className="f-col w-full justify-content-center gap-4">
                        <div className="h-sep mt-0" />
                        <ActionButton priority="primary" disabled>
                            <span className="body-bold">Continue</span>
                        </ActionButton>
                    </div>
                </div>
            </Card>
        </div>
    );
}
