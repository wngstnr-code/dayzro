// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IDayzroRegistry} from "./interfaces/IDayzroRegistry.sol";

/// @title DayzroFacility
/// @notice Financiers escrow stablecoins and set terms (discount APR, max tenor, per-buyer caps).
/// Holders of accepted receivables sell into a facility and get paid in the same transaction at an
/// onchain-computed price. The receivable NFT goes straight to the financier's wallet, so the buyer's
/// payment at maturity lands there automatically.
contract DayzroFacility is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 internal constant YEAR = 365 days;
    uint256 internal constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 100;
    uint16 public constant MAX_APR_BPS = 5_000;
    uint32 public constant MAX_TENOR_DAYS = 365;

    struct Facility {
        address financier;
        address token;
        uint16 aprBps;
        uint32 maxTenorDays;
        bool acceptGuaranteed;
        bool active;
        uint128 available;
    }

    IDayzroRegistry public immutable registry;
    uint16 public feeBps;
    address public treasury;
    uint256 public facilityCount;

    mapping(uint256 fid => Facility) internal _facilities;
    mapping(uint256 fid => mapping(address buyer => uint128)) public buyerCap;
    mapping(address financier => uint256[]) internal _byFinancier;

    event FacilityOpened(
        uint256 indexed fid,
        address indexed financier,
        address token,
        uint16 aprBps,
        uint32 maxTenorDays,
        bool acceptGuaranteed
    );
    event TermsSet(
        uint256 indexed fid, uint16 aprBps, uint32 maxTenorDays, bool acceptGuaranteed, bool active
    );
    event FacilityFunded(uint256 indexed fid, uint128 amount);
    event FacilityWithdrawn(uint256 indexed fid, uint128 amount);
    event BuyerCapSet(uint256 indexed fid, address indexed buyer, uint128 cap);
    event Financed(
        uint256 indexed fid, uint256 indexed rid, address indexed seller, uint128 price, uint128 fee
    );
    event FeeSet(uint16 feeBps);
    event TreasurySet(address treasury);

    error NotFinancier();
    error InvalidTerms();
    error InvalidAmount();
    error TokenNotAllowed();
    error NotHolder();
    error NotSellable(string reason);
    error PriceBelowMin();

    constructor(IDayzroRegistry registry_, address initialOwner, address treasury_, uint16 feeBps_)
        Ownable(initialOwner)
    {
        if (feeBps_ > MAX_FEE_BPS || treasury_ == address(0)) revert InvalidTerms();
        registry = registry_;
        treasury = treasury_;
        feeBps = feeBps_;
    }

    modifier onlyFinancier(uint256 fid) {
        if (_facilities[fid].financier != msg.sender) revert NotFinancier();
        _;
    }

    // ================================================================ financier

    function open(address token, uint16 aprBps, uint32 maxTenorDays, bool acceptGuaranteed, uint128 deposit)
        external
        nonReentrant
        returns (uint256 fid)
    {
        if (!registry.tokenAllowed(token)) revert TokenNotAllowed();
        _checkTerms(aprBps, maxTenorDays);
        fid = ++facilityCount;
        _facilities[fid] = Facility({
            financier: msg.sender,
            token: token,
            aprBps: aprBps,
            maxTenorDays: maxTenorDays,
            acceptGuaranteed: acceptGuaranteed,
            active: true,
            available: 0
        });
        _byFinancier[msg.sender].push(fid);
        emit FacilityOpened(fid, msg.sender, token, aprBps, maxTenorDays, acceptGuaranteed);
        if (deposit > 0) _fund(fid, deposit);
    }

    function fund(uint256 fid, uint128 amount) external nonReentrant onlyFinancier(fid) {
        _fund(fid, amount);
    }

    function withdraw(uint256 fid, uint128 amount) external nonReentrant onlyFinancier(fid) {
        Facility storage f = _facilities[fid];
        if (amount == 0 || amount > f.available) revert InvalidAmount();
        f.available -= amount;
        IERC20(f.token).safeTransfer(msg.sender, amount);
        emit FacilityWithdrawn(fid, amount);
    }

    function setTerms(uint256 fid, uint16 aprBps, uint32 maxTenorDays, bool acceptGuaranteed, bool active)
        external
        onlyFinancier(fid)
    {
        _checkTerms(aprBps, maxTenorDays);
        Facility storage f = _facilities[fid];
        f.aprBps = aprBps;
        f.maxTenorDays = maxTenorDays;
        f.acceptGuaranteed = acceptGuaranteed;
        f.active = active;
        emit TermsSet(fid, aprBps, maxTenorDays, acceptGuaranteed, active);
    }

    /// @notice Cap on unsecured exposure to `buyer`, measured across everything the financier holds.
    function setBuyerCap(uint256 fid, address buyer, uint128 cap) external onlyFinancier(fid) {
        buyerCap[fid][buyer] = cap;
        emit BuyerCapSet(fid, buyer, cap);
    }

    // ================================================================ seller

    /// @notice Sell receivable `rid` into facility `fid`. Caller must hold the NFT and have approved
    /// this contract. `minPrice` protects against terms changing before inclusion.
    function sell(uint256 fid, uint256 rid, uint128 minPrice) external nonReentrant {
        (bool ok, uint128 price, uint128 fee, string memory reason) = quote(fid, rid);
        if (!ok) revert NotSellable(reason);
        if (price < minPrice) revert PriceBelowMin();
        if (registry.ownerOf(rid) != msg.sender) revert NotHolder();

        Facility storage f = _facilities[fid];
        f.available -= price;
        registry.transferFrom(msg.sender, f.financier, rid);
        IERC20(f.token).safeTransfer(msg.sender, price - fee);
        if (fee > 0) IERC20(f.token).safeTransfer(treasury, fee);
        emit Financed(fid, rid, msg.sender, price, fee);
    }

    // ================================================================ admin

    function setFee(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert InvalidTerms();
        feeBps = feeBps_;
        emit FeeSet(feeBps_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidTerms();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    // ================================================================ views

    /// @notice Price the facility would pay for `rid` right now, the protocol fee taken from it,
    /// and a human-readable reason when the sale is not possible.
    function quote(uint256 fid, uint256 rid)
        public
        view
        returns (bool ok, uint128 price, uint128 fee, string memory reason)
    {
        Facility memory f = _facilities[fid];
        if (f.financier == address(0)) return (false, 0, 0, "unknown facility");
        if (!f.active) return (false, 0, 0, "facility inactive");

        (IDayzroRegistry.Receivable memory r,, uint128 remaining, address holder) =
            registry.getReceivable(rid);
        if (r.status != IDayzroRegistry.Status.Accepted) return (false, 0, 0, "receivable not accepted");
        if (r.token != f.token) return (false, 0, 0, "token mismatch");
        if (holder == f.financier) return (false, 0, 0, "already held by financier");
        if (block.timestamp >= r.dueDate) return (false, 0, 0, "overdue");

        uint256 t = r.dueDate - block.timestamp;
        if (t > uint256(f.maxTenorDays) * 1 days) return (false, 0, 0, "tenor too long");

        bool guaranteed = r.flags & 1 != 0;
        bool selfFinancing = f.financier == r.buyer;
        if (!selfFinancing && !(guaranteed && f.acceptGuaranteed)) {
            uint256 exposureAfter = uint256(registry.exposure(f.financier, r.buyer, r.token)) + remaining;
            if (exposureAfter > buyerCap[fid][r.buyer]) return (false, 0, 0, "buyer cap exceeded");
        }

        price = uint128(Math.mulDiv(remaining, YEAR * BPS, YEAR * BPS + uint256(f.aprBps) * t));
        if (price > f.available) return (false, price, 0, "insufficient liquidity");
        fee = uint128(uint256(price) * feeBps / BPS);
        return (true, price, fee, "");
    }

    function getFacility(uint256 fid) external view returns (Facility memory) {
        return _facilities[fid];
    }

    function facilitiesOf(address financier) external view returns (uint256[] memory) {
        return _byFinancier[financier];
    }

    // ================================================================ internal

    function _fund(uint256 fid, uint128 amount) internal {
        if (amount == 0) revert InvalidAmount();
        Facility storage f = _facilities[fid];
        IERC20(f.token).safeTransferFrom(msg.sender, address(this), amount);
        f.available += amount;
        emit FacilityFunded(fid, amount);
    }

    function _checkTerms(uint16 aprBps, uint32 maxTenorDays) internal pure {
        if (aprBps == 0 || aprBps > MAX_APR_BPS || maxTenorDays == 0 || maxTenorDays > MAX_TENOR_DAYS) {
            revert InvalidTerms();
        }
    }
}
