// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {DayzroRegistry} from "../../src/DayzroRegistry.sol";
import {DayzroFacility} from "../../src/DayzroFacility.sol";
import {IDayzroRegistry} from "../../src/interfaces/IDayzroRegistry.sol";

interface IMemo {
    function memo(address target, bytes calldata data, bytes32 memoId, bytes calldata memoData) external;
}

interface IMulticall3From {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external returns (Result[] memory);
}

/// @dev Runs against a fork of Arc mainnet with Arc Foundry:
///      arc-forge test --match-path 'test/fork/*' --fork-url $ARC_RPC_URL --network arc
contract ArcMainnetForkTest is Test {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant EURC = 0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1;
    address constant MEMO = 0x5294E9927c3306DcBaDb03fe70b92e01cCede505;
    address constant MULTICALL3_FROM = 0x522fAf9A91c41c443c66765030741e4AaCe147D0;

    DayzroRegistry registry;
    DayzroFacility facility;

    address supplier = makeAddr("supplier");
    address financier = makeAddr("financier");
    address treasury = makeAddr("treasury");
    // Well-known test keys (e.g. 0xB0B) are EIP-7702-delegated on Arc mainnet, which makes USDC
    // verify permits via ERC-1271. Use a key nobody else has touched.
    uint256 buyerKey = uint256(keccak256("dayzro.fork.buyer"));
    address buyer;

    function setUp() public {
        if (block.chainid != 5042) vm.skip(true);
        buyer = vm.addr(buyerKey);
        address[] memory tokens = new address[](2);
        tokens[0] = USDC;
        tokens[1] = EURC;
        registry = new DayzroRegistry(address(this), tokens);
        facility = new DayzroFacility(IDayzroRegistry(address(registry)), address(this), treasury, 25);

        // On Arc the native balance IS USDC (18 decimals); the ERC-20 view at 0x3600 uses 6 decimals.
        vm.deal(buyer, 10_000 ether);
        vm.deal(financier, 10_000 ether);
        vm.deal(supplier, 10 ether);
    }

    function _invoice(uint128 face, bool guaranteed) internal returns (uint256 id) {
        vm.prank(supplier);
        id = registry.createInvoice(
            buyer, USDC, face, uint64(block.timestamp + 60 days), keccak256("doc"), keccak256("INV-2026-001")
        );
        vm.startPrank(buyer);
        if (guaranteed) {
            IERC20(USDC).approve(address(registry), face);
            registry.depositGuarantee(USDC, face);
        }
        registry.accept(id, guaranteed);
        vm.stopPrank();
    }

    function test_fork_nativeBalanceIsUsdc() public view {
        assertEq(IERC20(USDC).balanceOf(buyer), 10_000e6);
    }

    function test_fork_fullLifecycleWithRealUsdc() public {
        uint256 id = _invoice(1_000e6, true);

        vm.startPrank(financier);
        IERC20(USDC).approve(address(facility), 5_000e6);
        uint256 fid = facility.open(USDC, 1_000, 90, true, 5_000e6);
        vm.stopPrank();

        (, uint128 price, uint128 fee,) = facility.quote(fid, id);
        uint256 supplierBefore = IERC20(USDC).balanceOf(supplier);
        vm.startPrank(supplier);
        registry.approve(address(facility), id);
        facility.sell(fid, id, price);
        vm.stopPrank();
        assertEq(IERC20(USDC).balanceOf(supplier) - supplierBefore, price - fee);
        assertEq(IERC20(USDC).balanceOf(treasury), fee);

        vm.warp(block.timestamp + 61 days);
        uint256 finBefore = IERC20(USDC).balanceOf(financier);
        registry.settleFromGuarantee(id);
        assertEq(IERC20(USDC).balanceOf(financier) - finBefore, 1_000e6);
        assertEq(IERC20(USDC).balanceOf(address(registry)), 0);
    }

    function test_fork_payWithPermitOnRealUsdc() public {
        uint256 id = _invoice(250e6, false);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                buyer,
                address(registry),
                uint256(250e6),
                IERC20Permit(USDC).nonces(buyer),
                deadline
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", IERC20Permit(USDC).DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyerKey, digest);
        vm.prank(buyer, buyer);
        registry.payWithPermit(id, 250e6, deadline, v, r, s);
        (IDayzroRegistry.Receivable memory rec,,,) = registry.getReceivable(id);
        assertEq(uint8(rec.status), uint8(IDayzroRegistry.Status.Paid));
    }

    function test_fork_payThroughArcMemo() public {
        uint256 id = _invoice(100e6, false);
        vm.prank(buyer);
        IERC20(USDC).approve(address(registry), 100e6);

        vm.prank(buyer, buyer);
        IMemo(MEMO)
            .memo(
                address(registry),
                abi.encodeCall(DayzroRegistry.pay, (id, uint128(100e6))),
                keccak256("INV-2026-001"),
                bytes("PO-7781")
            );
        (IDayzroRegistry.Receivable memory rec,,,) = registry.getReceivable(id);
        assertEq(uint8(rec.status), uint8(IDayzroRegistry.Status.Paid));
    }

    function test_fork_approveAndPayInOneTxViaMulticall3From() public {
        uint256 id = _invoice(100e6, false);
        IMulticall3From.Call3[] memory calls = new IMulticall3From.Call3[](2);
        calls[0] =
            IMulticall3From.Call3(USDC, false, abi.encodeCall(IERC20.approve, (address(registry), 100e6)));
        calls[1] = IMulticall3From.Call3(
            address(registry), false, abi.encodeCall(DayzroRegistry.pay, (id, uint128(100e6)))
        );
        vm.prank(buyer, buyer);
        IMulticall3From(MULTICALL3_FROM).aggregate3(calls);
        (IDayzroRegistry.Receivable memory rec,,,) = registry.getReceivable(id);
        assertEq(uint8(rec.status), uint8(IDayzroRegistry.Status.Paid));
    }
}
