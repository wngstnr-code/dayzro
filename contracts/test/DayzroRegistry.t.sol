// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base} from "./utils/Base.t.sol";
import {TestSmartWallet} from "./utils/Mocks.sol";
import {DayzroRegistry} from "../src/DayzroRegistry.sol";
import {IDayzroRegistry} from "../src/interfaces/IDayzroRegistry.sol";

contract DayzroRegistryTest is Base {
    // ================================================================ creation

    function test_createInvoice_mintsPendingToSupplier() public {
        uint256 id = _create(FACE, 30);
        assertEq(id, 1);
        assertEq(registry.ownerOf(id), supplier);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Pending));
        assertEq(registry.countBySupplier(supplier), 1);
        assertEq(registry.countByBuyer(buyer), 1);
        assertEq(registry.idsByBuyer(buyer, 0, 10)[0], id);
    }

    function test_createInvoice_validations() public {
        vm.startPrank(supplier);
        vm.expectRevert(DayzroRegistry.TokenNotAllowed.selector);
        registry.createInvoice(buyer, address(0xdead), FACE, _due(30), 0, 0);
        vm.expectRevert(DayzroRegistry.InvalidParty.selector);
        registry.createInvoice(supplier, address(usdc), FACE, _due(30), 0, 0);
        vm.expectRevert(DayzroRegistry.InvalidParty.selector);
        registry.createInvoice(address(0), address(usdc), FACE, _due(30), 0, 0);
        vm.expectRevert(DayzroRegistry.InvalidAmount.selector);
        registry.createInvoice(buyer, address(usdc), 1e6 - 1, _due(30), 0, 0);
        vm.expectRevert(DayzroRegistry.InvalidDueDate.selector);
        registry.createInvoice(buyer, address(usdc), FACE, uint64(block.timestamp), 0, 0);
        vm.expectRevert(DayzroRegistry.InvalidDueDate.selector);
        registry.createInvoice(buyer, address(usdc), FACE, _due(366), 0, 0);
        vm.stopPrank();
    }

    function test_pending_isNotTransferable() public {
        uint256 id = _create(FACE, 30);
        vm.prank(supplier);
        vm.expectRevert(DayzroRegistry.NotTransferable.selector);
        registry.transferFrom(supplier, financier, id);
    }

    function test_rejectAndCancel() public {
        uint256 a = _create(FACE, 30);
        uint256 b = _create(FACE, 30);
        vm.prank(stranger);
        vm.expectRevert(DayzroRegistry.NotBuyer.selector);
        registry.reject(a);
        vm.prank(buyer);
        registry.reject(a);
        vm.prank(supplier);
        registry.cancel(b);
        assertEq(uint8(_status(a)), uint8(IDayzroRegistry.Status.Cancelled));
        assertEq(uint8(_status(b)), uint8(IDayzroRegistry.Status.Cancelled));
        vm.prank(buyer);
        vm.expectRevert(DayzroRegistry.WrongStatus.selector);
        registry.accept(a, false);
    }

    // ================================================================ acceptance

    function test_accept_updatesStatsAndExposure() public {
        uint256 id = _createAccepted(FACE, 30, false);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Accepted));
        IDayzroRegistry.BuyerStats memory s = registry.buyerStats(buyer, address(usdc));
        assertEq(s.accepted, 1);
        assertEq(s.acceptedVolume, FACE);
        assertEq(s.outstanding, FACE);
        assertEq(registry.exposure(supplier, buyer, address(usdc)), FACE);
    }

    function test_accept_onlyBuyer() public {
        uint256 id = _create(FACE, 30);
        vm.prank(stranger);
        vm.expectRevert(DayzroRegistry.NotBuyer.selector);
        registry.accept(id, false);
    }

    function test_accept_afterDueReverts() public {
        uint256 id = _create(FACE, 30);
        vm.warp(block.timestamp + 30 days);
        vm.prank(buyer);
        vm.expectRevert(DayzroRegistry.InvalidDueDate.selector);
        registry.accept(id, false);
    }

    function test_acceptBySig_eoa() public {
        uint256 id = _create(FACE, 30);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signAccept(buyerKey, id, false, deadline);
        vm.prank(stranger);
        registry.acceptBySig(id, false, deadline, sig);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Accepted));

        // one-shot: the same signature cannot accept twice
        vm.expectRevert(DayzroRegistry.WrongStatus.selector);
        registry.acceptBySig(id, false, deadline, sig);
    }

    function test_acceptBySig_rejectsWrongSignerExpiredAndReplay() public {
        uint256 id = _create(FACE, 30);
        uint256 deadline = block.timestamp + 1 days;

        bytes memory wrong = _signAccept(0xBAD, id, false, deadline);
        vm.expectRevert(DayzroRegistry.BadSignature.selector);
        registry.acceptBySig(id, false, deadline, wrong);

        bytes memory sig = _signAccept(buyerKey, id, false, deadline);
        // guaranteed flag is part of the signed terms
        vm.expectRevert(DayzroRegistry.BadSignature.selector);
        registry.acceptBySig(id, true, deadline, sig);

        vm.warp(deadline + 1);
        vm.expectRevert(DayzroRegistry.SignatureExpired.selector);
        registry.acceptBySig(id, false, deadline, sig);
    }

    function test_acceptBySig_erc1271SmartWallet() public {
        TestSmartWallet safe = new TestSmartWallet(buyer);
        vm.prank(supplier);
        uint256 id = registry.createInvoice(address(safe), address(usdc), FACE, _due(30), 0, 0);
        uint256 deadline = block.timestamp + 1 days;
        (IDayzroRegistry.Receivable memory r,,,) = registry.getReceivable(id);
        bytes32 structHash = keccak256(
            abi.encode(
                registry.ACCEPT_TYPEHASH(), id, r.token, r.faceAmount, r.dueDate, r.docHash, false, deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(buyerKey, digest);
        registry.acceptBySig(id, false, deadline, abi.encodePacked(rr, s, v));
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Accepted));
    }

    function test_acceptBySig_parallelSignatures() public {
        uint256 a = _create(FACE, 30);
        uint256 b = _create(FACE, 30);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sigA = _signAccept(buyerKey, a, false, deadline);
        bytes memory sigB = _signAccept(buyerKey, b, false, deadline);
        registry.acceptBySig(b, false, deadline, sigB);
        registry.acceptBySig(a, false, deadline, sigA);
        assertEq(uint8(_status(a)), uint8(IDayzroRegistry.Status.Accepted));
        assertEq(uint8(_status(b)), uint8(IDayzroRegistry.Status.Accepted));
    }

    function test_acceptBySig_eip7702DelegatedEoa() public {
        // buyer's EOA has code (EIP-7702 delegation designator) whose delegate lacks ERC-1271
        vm.etch(buyer, hex"ef0100000000000000000000000000000000000000dead");
        uint256 id = _create(FACE, 30);
        uint256 deadline = block.timestamp + 1 days;
        registry.acceptBySig(id, false, deadline, _signAccept(buyerKey, id, false, deadline));
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Accepted));
    }

    function test_issuePayable_buyerIssuesAccepted() public {
        vm.prank(buyer);
        uint256 id =
            registry.issuePayable(supplier, address(usdc), FACE, _due(45), 0, keccak256("PO-9"), false);
        assertEq(registry.ownerOf(id), supplier);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Accepted));
        (IDayzroRegistry.Receivable memory r,,,) = registry.getReceivable(id);
        assertEq(r.flags & registry.FLAG_BUYER_ISSUED(), registry.FLAG_BUYER_ISSUED());
    }

    // ================================================================ payment

    function test_pay_fullOnTime() public {
        uint256 id = _createAccepted(FACE, 30, false);
        uint256 before = usdc.balanceOf(supplier);
        vm.prank(buyer);
        registry.pay(id, FACE);
        assertEq(usdc.balanceOf(supplier) - before, FACE);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));
        IDayzroRegistry.BuyerStats memory s = registry.buyerStats(buyer, address(usdc));
        assertEq(s.paidOnTime, 1);
        assertEq(s.paidVolume, FACE);
        assertEq(s.outstanding, 0);
        assertEq(registry.exposure(supplier, buyer, address(usdc)), 0);
    }

    function test_pay_overpayIsCapped() public {
        uint256 id = _createAccepted(FACE, 30, false);
        uint256 before = usdc.balanceOf(buyer);
        vm.prank(buyer);
        registry.pay(id, FACE * 2);
        assertEq(before - usdc.balanceOf(buyer), FACE);
    }

    function test_pay_partialThenTransferThenRest() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.prank(buyer);
        registry.pay(id, 400e6);
        assertEq(_remaining(id), 600e6);

        vm.prank(supplier);
        registry.transferFrom(supplier, financier, id);
        assertEq(registry.exposure(supplier, buyer, address(usdc)), 0);
        assertEq(registry.exposure(financier, buyer, address(usdc)), 600e6);

        uint256 before = usdc.balanceOf(financier);
        vm.prank(buyer);
        registry.pay(id, 600e6);
        assertEq(usdc.balanceOf(financier) - before, 600e6);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));
    }

    function test_pay_lateRecordsDaysLate() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.warp(block.timestamp + 30 days + 2 days + 1);
        vm.prank(buyer);
        registry.pay(id, FACE);
        IDayzroRegistry.BuyerStats memory s = registry.buyerStats(buyer, address(usdc));
        assertEq(s.paidLate, 1);
        assertEq(s.totalDaysLate, 3);
    }

    function test_pay_byAnyone() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.prank(stranger);
        registry.pay(id, FACE);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));
    }

    function test_paidReceivable_isSoulbound() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.prank(buyer);
        registry.pay(id, FACE);
        vm.prank(supplier);
        vm.expectRevert(DayzroRegistry.NotTransferable.selector);
        registry.transferFrom(supplier, financier, id);
        vm.prank(buyer);
        vm.expectRevert(DayzroRegistry.WrongStatus.selector);
        registry.pay(id, 1);
    }

    function test_payWithPermit() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.prank(buyer);
        usdc.approve(address(registry), 0);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                buyer,
                address(registry),
                uint256(FACE),
                usdc.nonces(buyer),
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(buyerKey, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), permitHash)));
        vm.prank(buyer);
        registry.payWithPermit(id, FACE, deadline, v, r, s);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));
    }

    function test_pay_blocklistedHolderFallsBackToClaimable() public {
        uint256 id = _createAccepted(FACE, 30, false);
        usdc.setBlocked(supplier, true);
        vm.prank(buyer);
        registry.pay(id, FACE);
        assertEq(registry.claimable(supplier, address(usdc)), FACE);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));

        usdc.setBlocked(supplier, false);
        vm.prank(supplier);
        registry.claim(address(usdc));
        assertEq(registry.claimable(supplier, address(usdc)), 0);
        vm.prank(supplier);
        vm.expectRevert(DayzroRegistry.NothingToClaim.selector);
        registry.claim(address(usdc));
    }

    // ================================================================ guarantee

    function test_guaranteed_requiresFreeBalanceAndLocks() public {
        uint256 id = _create(FACE, 30);
        vm.prank(buyer);
        vm.expectRevert(DayzroRegistry.InsufficientGuarantee.selector);
        registry.accept(id, true);

        _depositGuarantee(FACE);
        vm.prank(buyer);
        registry.accept(id, true);
        (uint128 bal, uint128 locked) = registry.guaranteeOf(buyer, address(usdc));
        assertEq(bal, FACE);
        assertEq(locked, FACE);

        vm.prank(buyer);
        vm.expectRevert(DayzroRegistry.InsufficientGuarantee.selector);
        registry.withdrawGuarantee(address(usdc), 1);
    }

    function test_guaranteed_walletPaymentUnlocks() public {
        uint256 id = _createAccepted(FACE, 30, true);
        vm.prank(buyer);
        registry.pay(id, FACE);
        (uint128 bal, uint128 locked) = registry.guaranteeOf(buyer, address(usdc));
        assertEq(bal, FACE);
        assertEq(locked, 0);
        vm.prank(buyer);
        registry.withdrawGuarantee(address(usdc), FACE);
    }

    function test_settleFromGuarantee() public {
        uint256 id = _createAccepted(FACE, 30, true);
        vm.expectRevert(DayzroRegistry.NotDueYet.selector);
        registry.settleFromGuarantee(id);

        vm.warp(block.timestamp + 31 days);
        uint256 before = usdc.balanceOf(supplier);
        vm.prank(stranger);
        registry.settleFromGuarantee(id);
        assertEq(usdc.balanceOf(supplier) - before, FACE);
        (uint128 bal, uint128 locked) = registry.guaranteeOf(buyer, address(usdc));
        assertEq(bal, 0);
        assertEq(locked, 0);
        assertEq(registry.buyerStats(buyer, address(usdc)).guaranteeSettled, 1);
    }

    function test_settleFromGuarantee_unsecuredReverts() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(DayzroRegistry.NotGuaranteed.selector);
        registry.settleFromGuarantee(id);
    }

    function test_payFromGuarantee_freeBalanceForUnsecured() public {
        uint256 id = _createAccepted(FACE, 30, false);
        _depositGuarantee(FACE / 2);
        vm.prank(buyer);
        vm.expectRevert(DayzroRegistry.InsufficientGuarantee.selector);
        registry.payFromGuarantee(id, FACE);
        vm.prank(buyer);
        registry.payFromGuarantee(id, FACE / 2);
        assertEq(_remaining(id), FACE / 2);
        vm.prank(stranger);
        vm.expectRevert(DayzroRegistry.NotBuyer.selector);
        registry.payFromGuarantee(id, 1);
    }

    // ================================================================ default

    function test_markDefault_andRecovery() public {
        uint256 id = _createAccepted(FACE, 30, false);
        vm.warp(block.timestamp + 60 days);
        vm.expectRevert(DayzroRegistry.NotDueYet.selector);
        registry.markDefault(id);

        vm.warp(block.timestamp + 1);
        vm.prank(stranger);
        registry.markDefault(id);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Defaulted));
        assertEq(registry.buyerStats(buyer, address(usdc)).defaults, 1);

        // debt sale still possible
        vm.prank(supplier);
        registry.transferFrom(supplier, financier, id);

        vm.prank(buyer);
        registry.pay(id, FACE);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));
        assertEq(registry.buyerStats(buyer, address(usdc)).paidLate, 1);
    }

    function test_markDefault_guaranteedReverts() public {
        uint256 id = _createAccepted(FACE, 30, true);
        vm.warp(block.timestamp + 90 days);
        vm.expectRevert(DayzroRegistry.IsGuaranteed.selector);
        registry.markDefault(id);
    }

    // ================================================================ holder adjustments

    function test_reduceFace_creditNote() public {
        uint256 id = _createAccepted(FACE, 30, true);
        vm.prank(stranger);
        vm.expectRevert(DayzroRegistry.NotHolder.selector);
        registry.reduceFace(id, 100e6);

        vm.prank(supplier);
        registry.reduceFace(id, 100e6);
        assertEq(_remaining(id), 900e6);
        (, uint128 locked) = registry.guaranteeOf(buyer, address(usdc));
        assertEq(locked, 900e6);
        assertEq(registry.buyerStats(buyer, address(usdc)).outstanding, 900e6);
    }

    function test_release_unpaidCancels_partiallyPaidCompletes() public {
        uint256 a = _createAccepted(FACE, 30, false);
        vm.prank(supplier);
        registry.release(a);
        assertEq(uint8(_status(a)), uint8(IDayzroRegistry.Status.Cancelled));

        uint256 b = _createAccepted(FACE, 30, false);
        vm.prank(buyer);
        registry.pay(b, 300e6);
        vm.prank(supplier);
        registry.release(b);
        assertEq(uint8(_status(b)), uint8(IDayzroRegistry.Status.Paid));
        assertEq(registry.buyerStats(buyer, address(usdc)).outstanding, 0);
    }

    // ================================================================ buyback

    function test_transferToBuyer_extinguishes() public {
        uint256 id = _createAccepted(FACE, 30, true);
        vm.prank(supplier);
        registry.transferFrom(supplier, buyer, id);
        assertEq(uint8(_status(id)), uint8(IDayzroRegistry.Status.Paid));
        assertEq(registry.exposure(buyer, buyer, address(usdc)), 0);
        (, uint128 locked) = registry.guaranteeOf(buyer, address(usdc));
        assertEq(locked, 0);
        assertEq(registry.buyerStats(buyer, address(usdc)).paidOnTime, 1);
    }

    // ================================================================ misc

    function test_profile() public {
        vm.prank(buyer);
        registry.setProfile("Acme Labs", "acme.xyz");
        (string memory n, string memory d) = registry.profileOf(buyer);
        assertEq(n, "Acme Labs");
        assertEq(d, "acme.xyz");
    }

    function test_allowToken_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.allowToken(address(0x1234));
        vm.prank(owner);
        registry.allowToken(address(0x1234));
        assertTrue(registry.tokenAllowed(address(0x1234)));
    }

    function test_tokenURI_isDataUri() public {
        uint256 id = _createAccepted(1_234_560_000, 30, true);
        string memory uri = registry.tokenURI(id);
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
    }

    function _prefix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) {
            out[i] = b[i];
        }
        return string(out);
    }
}
