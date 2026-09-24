// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {DayzroRegistry} from "../../src/DayzroRegistry.sol";
import {DayzroFacility} from "../../src/DayzroFacility.sol";
import {IDayzroRegistry} from "../../src/interfaces/IDayzroRegistry.sol";
import {TestStable} from "../utils/Mocks.sol";
import {Handler} from "./Handler.sol";

/// @dev Invariants 1-7 from docs/design.md §5.
contract DayzroInvariants is Test {
    DayzroRegistry internal registry;
    DayzroFacility internal facility;
    TestStable internal usdc;
    Handler internal handler;
    address[] internal actors;

    function setUp() public {
        vm.warp(1_790_000_000);
        usdc = new TestStable("USD Coin", "USDC");
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        registry = new DayzroRegistry(address(this), tokens);
        facility =
            new DayzroFacility(IDayzroRegistry(address(registry)), address(this), makeAddr("treasury"), 25);
        for (uint256 i; i < 4; ++i) {
            actors.push(makeAddr(string.concat("actor", vm.toString(i))));
        }
        handler = new Handler(registry, facility, usdc, actors);
        targetContract(address(handler));
    }

    /// 1. Registry holds exactly guarantees + claimables.
    function invariant_registrySolvent() public view {
        uint256 expected;
        for (uint256 i; i < actors.length; ++i) {
            (uint128 bal,) = registry.guaranteeOf(actors[i], address(usdc));
            expected += bal + registry.claimable(actors[i], address(usdc));
        }
        assertEq(usdc.balanceOf(address(registry)), expected);
    }

    /// 2. Facility holds exactly the sum of available liquidity.
    function invariant_facilitySolvent() public view {
        uint256 expected;
        for (uint256 fid = 1; fid <= facility.facilityCount(); ++fid) {
            expected += facility.getFacility(fid).available;
        }
        assertEq(usdc.balanceOf(address(facility)), expected);
    }

    /// 3-6. Per-receivable accounting matches aggregates.
    function invariant_accounting() public view {
        uint256 n = actors.length;
        uint256[] memory lockedExpected = new uint256[](n);
        uint256[] memory outstandingExpected = new uint256[](n);
        uint256[][] memory exposureExpected = new uint256[][](n);
        for (uint256 i; i < n; ++i) {
            exposureExpected[i] = new uint256[](n);
        }

        for (uint256 id = 1; id <= registry.totalReceivables(); ++id) {
            (IDayzroRegistry.Receivable memory r,, uint128 remaining, address holder) =
                registry.getReceivable(id);
            assertLe(r.paidAmount, r.faceAmount, "paid > face");
            bool live =
                r.status == IDayzroRegistry.Status.Accepted || r.status == IDayzroRegistry.Status.Defaulted;
            if (!live) {
                if (r.status == IDayzroRegistry.Status.Paid) assertEq(remaining, 0, "paid with remaining");
                continue;
            }
            uint256 b = _index(r.buyer);
            outstandingExpected[b] += remaining;
            exposureExpected[_index(holder)][b] += remaining;
            if (r.flags & 1 != 0) lockedExpected[b] += remaining;
        }

        for (uint256 b; b < n; ++b) {
            (uint128 bal, uint128 locked) = registry.guaranteeOf(actors[b], address(usdc));
            assertLe(locked, bal, "locked > balance");
            assertEq(locked, lockedExpected[b], "locked != guaranteed remaining");
            assertEq(
                registry.buyerStats(actors[b], address(usdc)).outstanding,
                outstandingExpected[b],
                "outstanding"
            );
            for (uint256 h; h < n; ++h) {
                assertEq(
                    registry.exposure(actors[h], actors[b], address(usdc)), exposureExpected[h][b], "exposure"
                );
            }
        }
    }

    function _index(address a) internal view returns (uint256) {
        for (uint256 i; i < actors.length; ++i) {
            if (actors[i] == a) return i;
        }
        revert("unknown actor");
    }
}
