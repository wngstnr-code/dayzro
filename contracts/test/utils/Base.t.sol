// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {DayzroRegistry} from "../../src/DayzroRegistry.sol";
import {DayzroFacility} from "../../src/DayzroFacility.sol";
import {IDayzroRegistry} from "../../src/interfaces/IDayzroRegistry.sol";
import {TestStable} from "./Mocks.sol";

abstract contract Base is Test {
    DayzroRegistry internal registry;
    DayzroFacility internal facility;
    TestStable internal usdc;
    TestStable internal eurc;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal supplier = makeAddr("supplier");
    address internal financier = makeAddr("financier");
    address internal stranger = makeAddr("stranger");
    uint256 internal buyerKey = 0xB0B;
    address internal buyer;

    uint128 internal constant FACE = 1_000e6;
    uint16 internal constant FEE_BPS = 25;

    function setUp() public virtual {
        vm.warp(1_790_000_000);
        buyer = vm.addr(buyerKey);
        usdc = new TestStable("USD Coin", "USDC");
        eurc = new TestStable("Euro Coin", "EURC");
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(eurc);
        registry = new DayzroRegistry(owner, tokens);
        facility = new DayzroFacility(IDayzroRegistry(address(registry)), owner, treasury, FEE_BPS);

        address[4] memory actors = [supplier, buyer, financier, stranger];
        for (uint256 i; i < actors.length; ++i) {
            usdc.mint(actors[i], 1_000_000e6);
            eurc.mint(actors[i], 1_000_000e6);
            vm.startPrank(actors[i]);
            usdc.approve(address(registry), type(uint256).max);
            usdc.approve(address(facility), type(uint256).max);
            eurc.approve(address(registry), type(uint256).max);
            eurc.approve(address(facility), type(uint256).max);
            registry.setApprovalForAll(address(facility), true);
            vm.stopPrank();
        }
    }

    // ---------------------------------------------------------------- helpers

    function _due(uint256 daysFromNow) internal view returns (uint64) {
        return uint64(block.timestamp + daysFromNow * 1 days);
    }

    function _create(uint128 face, uint256 days_) internal returns (uint256 id) {
        vm.prank(supplier);
        id = registry.createInvoice(
            buyer, address(usdc), face, _due(days_), keccak256("doc"), keccak256("INV-1")
        );
    }

    function _createAccepted(uint128 face, uint256 days_, bool guaranteed) internal returns (uint256 id) {
        id = _create(face, days_);
        if (guaranteed) _depositGuarantee(face);
        vm.prank(buyer);
        registry.accept(id, guaranteed);
    }

    function _depositGuarantee(uint128 amount) internal {
        vm.prank(buyer);
        registry.depositGuarantee(address(usdc), amount);
    }

    function _status(uint256 id) internal view returns (IDayzroRegistry.Status) {
        (IDayzroRegistry.Receivable memory r,,,) = registry.getReceivable(id);
        return r.status;
    }

    function _remaining(uint256 id) internal view returns (uint128 remaining) {
        (,, remaining,) = registry.getReceivable(id);
    }

    function _signAccept(uint256 key, uint256 id, bool guaranteed, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        (IDayzroRegistry.Receivable memory r,,,) = registry.getReceivable(id);
        bytes32 structHash = keccak256(
            abi.encode(
                registry.ACCEPT_TYPEHASH(),
                id,
                r.token,
                r.faceAmount,
                r.dueDate,
                r.docHash,
                guaranteed,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(rr, s, v);
    }
}
