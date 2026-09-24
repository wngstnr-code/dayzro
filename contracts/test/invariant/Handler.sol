// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {DayzroRegistry} from "../../src/DayzroRegistry.sol";
import {DayzroFacility} from "../../src/DayzroFacility.sol";
import {IDayzroRegistry} from "../../src/interfaces/IDayzroRegistry.sol";
import {TestStable} from "../utils/Mocks.sol";

/// @dev Drives random, mostly-valid actions against Registry + Facility with a fixed actor set.
contract Handler is Test {
    DayzroRegistry public registry;
    DayzroFacility public facility;
    TestStable public usdc;

    address[] public actors;
    mapping(bytes32 => uint256) public hits;
    uint256[] public facilityIds;

    constructor(
        DayzroRegistry registry_,
        DayzroFacility facility_,
        TestStable usdc_,
        address[] memory actors_
    ) {
        registry = registry_;
        facility = facility_;
        usdc = usdc_;
        actors = actors_;
        for (uint256 i; i < actors.length; ++i) {
            usdc.mint(actors[i], 1e15);
            vm.startPrank(actors[i]);
            usdc.approve(address(registry), type(uint256).max);
            usdc.approve(address(facility), type(uint256).max);
            registry.setApprovalForAll(address(facility), true);
            vm.stopPrank();
        }
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _id(uint256 seed) internal view returns (uint256) {
        uint256 n = registry.totalReceivables();
        return n == 0 ? 0 : 1 + (seed % n);
    }

    // ---------------------------------------------------------------- registry actions

    function create(uint256 sSeed, uint256 bSeed, uint128 face, uint16 days_) external {
        address s = _actor(sSeed);
        address b = _actor(bSeed);
        if (s == b) return;
        face = uint128(bound(face, 1e6, 1e11));
        days_ = uint16(bound(days_, 1, 200));
        vm.prank(s);
        registry.createInvoice(
            b, address(usdc), face, uint64(block.timestamp + uint256(days_) * 1 days), 0, 0
        );
    }

    function accept(uint256 idSeed, bool guaranteed) external {
        uint256 id = _id(idSeed);
        if (id == 0) return;
        (IDayzroRegistry.Receivable memory r,,,) = registry.getReceivable(id);
        if (r.status != IDayzroRegistry.Status.Pending || block.timestamp >= r.dueDate) return;
        if (guaranteed) {
            (uint128 bal, uint128 locked) = registry.guaranteeOf(r.buyer, address(usdc));
            if (bal - locked < r.faceAmount) {
                vm.prank(r.buyer);
                registry.depositGuarantee(address(usdc), r.faceAmount - (bal - locked));
            }
        }
        vm.prank(r.buyer);
        registry.accept(id, guaranteed);
        hits["accept"]++;
    }

    function pay(uint256 idSeed, uint256 payerSeed, uint128 amount) external {
        uint256 id = _id(idSeed);
        if (id == 0) return;
        (IDayzroRegistry.Receivable memory r,, uint128 remaining,) = registry.getReceivable(id);
        if (r.status != IDayzroRegistry.Status.Accepted && r.status != IDayzroRegistry.Status.Defaulted) {
            return;
        }
        amount = uint128(bound(amount, 1, remaining));
        vm.prank(_actor(payerSeed));
        registry.pay(id, amount);
        hits["pay"]++;
    }

    function payFromGuarantee(uint256 idSeed, uint128 amount) external {
        uint256 id = _id(idSeed);
        if (id == 0) return;
        (IDayzroRegistry.Receivable memory r,, uint128 remaining,) = registry.getReceivable(id);
        if (r.status != IDayzroRegistry.Status.Accepted && r.status != IDayzroRegistry.Status.Defaulted) {
            return;
        }
        amount = uint128(bound(amount, 1, remaining));
        if (r.flags & 1 == 0) {
            (uint128 bal, uint128 locked) = registry.guaranteeOf(r.buyer, address(usdc));
            if (bal - locked < amount) {
                vm.prank(r.buyer);
                registry.depositGuarantee(address(usdc), amount);
            }
        }
        vm.prank(r.buyer);
        registry.payFromGuarantee(id, amount);
    }

    function transfer(uint256 idSeed, uint256 toSeed) external {
        uint256 id = _id(idSeed);
        if (id == 0) return;
        (IDayzroRegistry.Receivable memory r,,, address holder) = registry.getReceivable(id);
        if (r.status != IDayzroRegistry.Status.Accepted && r.status != IDayzroRegistry.Status.Defaulted) {
            return;
        }
        address to = _actor(toSeed);
        if (to == holder) return;
        vm.prank(holder);
        registry.transferFrom(holder, to, id);
        hits["transfer"]++;
    }

    function reduce(uint256 idSeed, uint128 amount) external {
        uint256 id = _id(idSeed);
        if (id == 0) return;
        (IDayzroRegistry.Receivable memory r,, uint128 remaining, address holder) = registry.getReceivable(id);
        if (r.status != IDayzroRegistry.Status.Accepted && r.status != IDayzroRegistry.Status.Defaulted) {
            return;
        }
        amount = uint128(bound(amount, 1, remaining));
        vm.prank(holder);
        registry.reduceFace(id, amount);
    }

    function settleOrDefault(uint256 idSeed) external {
        uint256 n = registry.totalReceivables();
        for (uint256 i; i < n; ++i) {
            uint256 id = 1 + (idSeed + i) % n;
            (IDayzroRegistry.Receivable memory r,,,) = registry.getReceivable(id);
            if (r.status != IDayzroRegistry.Status.Accepted) continue;
            if (r.flags & 1 != 0) {
                if (block.timestamp > r.dueDate) {
                    registry.settleFromGuarantee(id);
                    hits["settle"]++;
                    return;
                }
            } else if (block.timestamp > uint256(r.dueDate) + 30 days) {
                registry.markDefault(id);
                hits["default"]++;
                return;
            }
        }
    }

    function depositGuarantee(uint256 seed, uint128 amount) external {
        amount = uint128(bound(amount, 1, 1e10));
        vm.prank(_actor(seed));
        registry.depositGuarantee(address(usdc), amount);
    }

    function withdrawGuarantee(uint256 seed, uint128 amount) external {
        address a = _actor(seed);
        (uint128 bal, uint128 locked) = registry.guaranteeOf(a, address(usdc));
        if (bal == locked) return;
        amount = uint128(bound(amount, 1, bal - locked));
        vm.prank(a);
        registry.withdrawGuarantee(address(usdc), amount);
    }

    function warp(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 hours, 20 days));
    }

    // ---------------------------------------------------------------- facility actions

    function openFacility(uint256 seed, uint16 apr, bool acceptGuaranteed, uint128 deposit) external {
        apr = uint16(bound(apr, 1, 5_000));
        deposit = uint128(bound(deposit, 1e9, 1e12));
        vm.prank(_actor(seed));
        facilityIds.push(facility.open(address(usdc), apr, 365, acceptGuaranteed, deposit));
    }

    function setCap(uint256 fSeed, uint256 bSeed, uint128 cap) external {
        if (facilityIds.length == 0) return;
        uint256 fid = facilityIds[fSeed % facilityIds.length];
        vm.prank(facility.getFacility(fid).financier);
        facility.setBuyerCap(fid, _actor(bSeed), uint128(bound(cap, 0, 1e11)));
    }

    function withdrawFacility(uint256 fSeed, uint128 amount) external {
        if (facilityIds.length == 0) return;
        uint256 fid = facilityIds[fSeed % facilityIds.length];
        DayzroFacility.Facility memory f = facility.getFacility(fid);
        if (f.available == 0) return;
        vm.prank(f.financier);
        facility.withdraw(fid, uint128(bound(amount, 1, f.available)));
    }

    /// @dev Scans for a sellable (facility, receivable) pair starting from random offsets.
    function sell(uint256 fSeed, uint256 idSeed) external {
        uint256 nf = facilityIds.length;
        uint256 n = registry.totalReceivables();
        if (nf == 0 || n == 0) return;
        for (uint256 i; i < n; ++i) {
            uint256 id = 1 + (idSeed + i) % n;
            for (uint256 j; j < nf; ++j) {
                uint256 fid = facilityIds[(fSeed + j) % nf];
                (bool ok,,,) = facility.quote(fid, id);
                if (!ok) continue;
                vm.prank(registry.ownerOf(id));
                facility.sell(fid, id, 0);
                hits["sell"]++;
                return;
            }
        }
    }
}
