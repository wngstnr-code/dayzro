// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base} from "./utils/Base.t.sol";
import {DayzroFacility} from "../src/DayzroFacility.sol";
import {IDayzroRegistry} from "../src/interfaces/IDayzroRegistry.sol";

contract DayzroFacilityTest is Base {
    uint16 internal constant APR = 1_000; // 10%

    function _open(bool acceptGuaranteed, uint128 deposit) internal returns (uint256 fid) {
        vm.prank(financier);
        fid = facility.open(address(usdc), APR, 90, acceptGuaranteed, deposit);
    }

    // ================================================================ financier

    function test_openFundWithdraw() public {
        uint256 fid = _open(true, 10_000e6);
        assertEq(facility.getFacility(fid).available, 10_000e6);
        assertEq(usdc.balanceOf(address(facility)), 10_000e6);

        vm.prank(financier);
        facility.fund(fid, 5_000e6);
        vm.prank(financier);
        facility.withdraw(fid, 15_000e6);
        assertEq(facility.getFacility(fid).available, 0);

        vm.prank(stranger);
        vm.expectRevert(DayzroFacility.NotFinancier.selector);
        facility.fund(fid, 1);
    }

    function test_open_validatesTerms() public {
        vm.startPrank(financier);
        vm.expectRevert(DayzroFacility.InvalidTerms.selector);
        facility.open(address(usdc), 0, 90, true, 0);
        vm.expectRevert(DayzroFacility.InvalidTerms.selector);
        facility.open(address(usdc), 5_001, 90, true, 0);
        vm.expectRevert(DayzroFacility.InvalidTerms.selector);
        facility.open(address(usdc), APR, 366, true, 0);
        vm.expectRevert(DayzroFacility.TokenNotAllowed.selector);
        facility.open(address(0xdead), APR, 90, true, 0);
        vm.stopPrank();
    }

    // ================================================================ pricing

    function test_quote_matchesDesignExample() public {
        // $1,000, 60 days, 10% APR -> 1000 / (1 + 0.10 * 60/365) = 983.83
        uint256 fid = _open(true, 10_000e6);
        uint256 rid = _createAccepted(FACE, 60, true);
        (bool ok, uint128 price, uint128 fee,) = facility.quote(fid, rid);
        assertTrue(ok);
        assertEq(price, 983_827_493); // 1e9 * 3_650_000 / 3_710_000, rounded down
        assertEq(fee, price * FEE_BPS / 10_000);
    }

    function testFuzz_quote_boundedAndMonotonic(uint128 face, uint16 apr, uint32 days_) public {
        face = uint128(bound(face, 1e6, 1e15));
        apr = uint16(bound(apr, 1, 5_000));
        days_ = uint32(bound(days_, 2, 365));
        vm.prank(financier);
        uint256 fid = facility.open(address(usdc), apr, 365, true, 0);
        usdc.mint(financier, face);
        usdc.mint(buyer, face);
        vm.prank(financier);
        facility.fund(fid, face);

        uint256 rid = _createAccepted(face, days_, true);
        (bool ok, uint128 priceNow,,) = facility.quote(fid, rid);
        assertTrue(ok);
        assertLe(priceNow, face);

        vm.warp(block.timestamp + 1 days);
        (, uint128 priceLater,,) = facility.quote(fid, rid);
        assertGe(priceLater, priceNow);
    }

    // ================================================================ selling

    function test_sell_guaranteedWithoutCap() public {
        uint256 fid = _open(true, 10_000e6);
        uint256 rid = _createAccepted(FACE, 60, true);
        (, uint128 price, uint128 fee,) = facility.quote(fid, rid);

        uint256 supplierBefore = usdc.balanceOf(supplier);
        vm.prank(supplier);
        facility.sell(fid, rid, price);

        assertEq(registry.ownerOf(rid), financier);
        assertEq(usdc.balanceOf(supplier) - supplierBefore, price - fee);
        assertEq(usdc.balanceOf(treasury), fee);
        assertEq(facility.getFacility(fid).available, 10_000e6 - price);
        assertEq(registry.exposure(financier, buyer, address(usdc)), FACE);

        // buyer pays at maturity -> financier receives face value
        uint256 finBefore = usdc.balanceOf(financier);
        vm.warp(block.timestamp + 60 days);
        vm.prank(buyer);
        registry.pay(rid, FACE);
        assertEq(usdc.balanceOf(financier) - finBefore, FACE);
    }

    function test_sell_unsecuredNeedsCap() public {
        uint256 fid = _open(true, 10_000e6);
        uint256 rid = _createAccepted(FACE, 60, false);
        (bool ok,,, string memory reason) = facility.quote(fid, rid);
        assertFalse(ok);
        assertEq(reason, "buyer cap exceeded");

        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(DayzroFacility.NotSellable.selector, "buyer cap exceeded"));
        facility.sell(fid, rid, 0);

        vm.prank(financier);
        facility.setBuyerCap(fid, buyer, FACE);
        vm.prank(supplier);
        facility.sell(fid, rid, 0);
        assertEq(registry.ownerOf(rid), financier);
    }

    function test_cap_freesUpWhenBuyerPays() public {
        uint256 fid = _open(false, 10_000e6);
        vm.prank(financier);
        facility.setBuyerCap(fid, buyer, FACE);

        uint256 first = _createAccepted(FACE, 60, false);
        uint256 second = _createAccepted(FACE, 60, false);
        vm.prank(supplier);
        facility.sell(fid, first, 0);
        (bool ok,,,) = facility.quote(fid, second);
        assertFalse(ok);

        vm.prank(buyer);
        registry.pay(first, FACE);
        (ok,,,) = facility.quote(fid, second);
        assertTrue(ok);
    }

    function test_sell_guards() public {
        uint256 fid = _open(true, 10_000e6);
        uint256 rid = _createAccepted(FACE, 60, true);

        vm.prank(stranger);
        vm.expectRevert(DayzroFacility.NotHolder.selector);
        facility.sell(fid, rid, 0);

        vm.prank(supplier);
        vm.expectRevert(DayzroFacility.PriceBelowMin.selector);
        facility.sell(fid, rid, FACE);

        uint256 pending = _create(FACE, 60);
        (bool ok,,, string memory reason) = facility.quote(fid, pending);
        assertFalse(ok);
        assertEq(reason, "receivable not accepted");

        uint256 longTenor = _createAccepted(FACE, 120, true);
        (ok,,, reason) = facility.quote(fid, longTenor);
        assertEq(reason, "tenor too long");

        vm.prank(financier);
        facility.setTerms(fid, APR, 90, true, false);
        (ok,,, reason) = facility.quote(fid, rid);
        assertEq(reason, "facility inactive");
    }

    function test_sell_insufficientLiquidity() public {
        uint256 fid = _open(true, 100e6);
        uint256 rid = _createAccepted(FACE, 60, true);
        (bool ok,,, string memory reason) = facility.quote(fid, rid);
        assertFalse(ok);
        assertEq(reason, "insufficient liquidity");
    }

    function test_selfFinancing_buyerPaysEarlyAtDiscount() public {
        vm.prank(buyer);
        uint256 fid = facility.open(address(usdc), APR, 90, false, 10_000e6);
        uint256 rid = _createAccepted(FACE, 60, false);

        (, uint128 price, uint128 fee,) = facility.quote(fid, rid);
        uint256 supplierBefore = usdc.balanceOf(supplier);
        vm.prank(supplier);
        facility.sell(fid, rid, 0);

        assertEq(usdc.balanceOf(supplier) - supplierBefore, price - fee);
        assertEq(uint8(_status(rid)), uint8(IDayzroRegistry.Status.Paid));
        IDayzroRegistry.BuyerStats memory s = registry.buyerStats(buyer, address(usdc));
        assertEq(s.paidOnTime, 1);
        assertEq(s.outstanding, 0);
    }

    // ================================================================ admin

    function test_admin_feeCapped() public {
        vm.prank(owner);
        vm.expectRevert(DayzroFacility.InvalidTerms.selector);
        facility.setFee(101);
        vm.prank(owner);
        facility.setFee(100);
        assertEq(facility.feeBps(), 100);
        vm.prank(stranger);
        vm.expectRevert();
        facility.setTreasury(stranger);
    }
}
