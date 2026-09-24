// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IDayzroRegistry} from "./interfaces/IDayzroRegistry.sol";
import {DayzroRenderer} from "./DayzroRenderer.sol";

/// @title DayzroRegistry
/// @notice Buyer-accepted invoices as transferable ERC-721 receivables on Arc.
/// A supplier issues an invoice, the buyer accepts it onchain (tx or EIP-712 / ERC-1271 signature),
/// and the receivable can then be sold. The buyer pays this contract and funds flow to whoever
/// holds the NFT. Payment history is recorded as onchain buyer stats.
/// @dev Only ERC-20 stablecoins (USDC / EURC interfaces on Arc, 6 decimals). Never touches native value.
contract DayzroRegistry is IDayzroRegistry, ERC721Enumerable, EIP712, ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- constants

    uint32 public constant FLAG_GUARANTEED = 1 << 0;
    uint32 public constant FLAG_EVER_DEFAULTED = 1 << 1;
    uint32 public constant FLAG_BUYER_ISSUED = 1 << 2;

    uint8 public constant SRC_WALLET = 0;
    uint8 public constant SRC_GUARANTEE = 1;
    uint8 public constant SRC_GUARANTEE_SETTLE = 2;
    uint8 public constant SRC_BUYBACK = 3;

    uint64 public constant DEFAULT_GRACE = 30 days;
    uint64 public constant MAX_TENOR = 365 days;
    uint128 public constant MIN_FACE = 1e6;

    /// @dev No nonce: the signature is bound to one receivable id (and the domain), and a receivable can
    /// only be accepted once, so it cannot be replayed. This lets a buyer sign many invoices in parallel.
    bytes32 public constant ACCEPT_TYPEHASH = keccak256(
        "Accept(uint256 id,address token,uint128 faceAmount,uint64 dueDate,bytes32 docHash,bool guaranteed,uint256 deadline)"
    );

    // ---------------------------------------------------------------- storage

    struct Guarantee {
        uint128 balance;
        uint128 locked;
    }

    struct Profile {
        string name;
        string domain;
    }

    uint256 public totalReceivables;

    mapping(uint256 id => Receivable) internal _receivables;
    mapping(address supplier => uint256[]) internal _bySupplier;
    mapping(address buyer => uint256[]) internal _byBuyer;
    mapping(address buyer => mapping(address token => BuyerStats)) internal _stats;
    mapping(address buyer => mapping(address token => Guarantee)) internal _guarantees;
    mapping(address holder => mapping(address buyer => mapping(address token => uint128))) internal _exposure;
    mapping(address account => mapping(address token => uint256)) public claimable;
    mapping(address token => bool) public tokenAllowed;
    mapping(address account => Profile) internal _profiles;

    // ---------------------------------------------------------------- events

    event InvoiceCreated(
        uint256 indexed id,
        address indexed supplier,
        address indexed buyer,
        address token,
        uint128 faceAmount,
        uint64 dueDate,
        bytes32 docHash,
        bytes32 ref
    );
    event Accepted(uint256 indexed id, address indexed buyer, bool guaranteed);
    event Rejected(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event Paid(
        uint256 indexed id,
        address indexed payer,
        address indexed holder,
        uint128 amount,
        uint8 source,
        bool pushed
    );
    event Settled(uint256 indexed id, bool onTime);
    event Defaulted(uint256 indexed id, address indexed buyer);
    event FaceReduced(uint256 indexed id, uint128 newFaceAmount);
    event GuaranteeDeposited(address indexed buyer, address indexed token, uint128 amount);
    event GuaranteeWithdrawn(address indexed buyer, address indexed token, uint128 amount);
    event Claimed(address indexed account, address indexed token, uint256 amount);
    event ProfileSet(address indexed account, string name, string domain);
    event TokenAllowed(address indexed token);

    // ---------------------------------------------------------------- errors

    error TokenNotAllowed();
    error InvalidParty();
    error InvalidAmount();
    error InvalidDueDate();
    error NotBuyer();
    error NotSupplier();
    error NotHolder();
    error WrongStatus();
    error NotGuaranteed();
    error IsGuaranteed();
    error NotDueYet();
    error InsufficientGuarantee();
    error SignatureExpired();
    error BadSignature();
    error NotTransferable();
    error NothingToClaim();
    error StringTooLong();

    // ---------------------------------------------------------------- constructor

    constructor(address initialOwner, address[] memory tokens)
        ERC721("Dayzro Receivable", "DZRO")
        EIP712("Dayzro", "1")
        Ownable(initialOwner)
    {
        for (uint256 i; i < tokens.length; ++i) {
            _allowToken(tokens[i]);
        }
    }

    // ================================================================ issuance & acceptance

    /// @notice Supplier issues an invoice to `buyer`. The NFT is minted to the supplier and stays
    /// non-transferable until the buyer accepts.
    function createInvoice(
        address buyer,
        address token,
        uint128 faceAmount,
        uint64 dueDate,
        bytes32 docHash,
        bytes32 ref
    ) external returns (uint256 id) {
        id = _create(msg.sender, buyer, token, faceAmount, dueDate, docHash, ref, 0);
    }

    /// @notice Buyer issues an already-accepted payable to `supplier` (e.g. an approved purchase order).
    function issuePayable(
        address supplier,
        address token,
        uint128 faceAmount,
        uint64 dueDate,
        bytes32 docHash,
        bytes32 ref,
        bool guaranteed
    ) external nonReentrant returns (uint256 id) {
        id = _create(supplier, msg.sender, token, faceAmount, dueDate, docHash, ref, FLAG_BUYER_ISSUED);
        _accept(id, guaranteed);
    }

    function accept(uint256 id, bool guaranteed) external nonReentrant {
        if (_receivables[id].buyer != msg.sender) revert NotBuyer();
        _accept(id, guaranteed);
    }

    /// @notice Anyone may submit the buyer's EIP-712 acceptance. The signature commits to every
    /// economic term, so terms cannot change after signing.
    /// @dev Accepts an ECDSA signature from the buyer's key even when the buyer has code (EIP-7702
    /// delegated EOAs), and falls back to ERC-1271 for smart wallets such as Safe.
    function acceptBySig(uint256 id, bool guaranteed, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        if (block.timestamp > deadline) revert SignatureExpired();
        Receivable storage r = _receivables[id];
        address buyer = r.buyer;
        if (buyer == address(0)) revert WrongStatus();
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ACCEPT_TYPEHASH, id, r.token, r.faceAmount, r.dueDate, r.docHash, guaranteed, deadline
                )
            )
        );
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        bool valid = (err == ECDSA.RecoverError.NoError && recovered == buyer)
            || (buyer.code.length > 0
                && SignatureChecker.isValidERC1271SignatureNow(buyer, digest, signature));
        if (!valid) revert BadSignature();
        _accept(id, guaranteed);
    }

    function reject(uint256 id) external {
        Receivable storage r = _receivables[id];
        if (r.buyer != msg.sender) revert NotBuyer();
        if (r.status != Status.Pending) revert WrongStatus();
        r.status = Status.Cancelled;
        emit Rejected(id);
    }

    function cancel(uint256 id) external {
        Receivable storage r = _receivables[id];
        if (r.supplier != msg.sender) revert NotSupplier();
        if (r.status != Status.Pending) revert WrongStatus();
        r.status = Status.Cancelled;
        emit Cancelled(id);
    }

    // ================================================================ payment & settlement

    /// @notice Pay `amount` (capped at the remaining balance) from the caller's wallet.
    /// Works through Arc's Memo and Multicall3From contracts since they preserve msg.sender.
    function pay(uint256 id, uint128 amount) external nonReentrant {
        _settle(id, amount, SRC_WALLET);
    }

    function payWithPermit(uint256 id, uint128 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        // A front-run permit only consumes the nonce; the allowance is still set, so ignore failures.
        try IERC20Permit(_receivables[id].token)
            .permit(msg.sender, address(this), amount, deadline, v, r, s) {}
            catch {}
        _settle(id, amount, SRC_WALLET);
    }

    /// @notice Buyer pays from its guarantee balance (locked portion for guaranteed receivables,
    /// free portion otherwise).
    function payFromGuarantee(uint256 id, uint128 amount) external nonReentrant {
        if (_receivables[id].buyer != msg.sender) revert NotBuyer();
        _settle(id, amount, SRC_GUARANTEE);
    }

    /// @notice After the due date anyone (typically the holder) can settle a guaranteed receivable
    /// from the buyer's locked guarantee.
    function settleFromGuarantee(uint256 id) external nonReentrant {
        Receivable storage r = _receivables[id];
        if (r.flags & FLAG_GUARANTEED == 0) revert NotGuaranteed();
        if (block.timestamp <= r.dueDate) revert NotDueYet();
        _settle(id, r.faceAmount - r.paidAmount, SRC_GUARANTEE_SETTLE);
    }

    /// @notice Anyone may mark an unsecured receivable as defaulted once the grace period has passed.
    /// A defaulted receivable can still be paid (recovery) and transferred (debt sale).
    function markDefault(uint256 id) external {
        Receivable storage r = _receivables[id];
        if (r.status != Status.Accepted) revert WrongStatus();
        if (r.flags & FLAG_GUARANTEED != 0) revert IsGuaranteed();
        if (block.timestamp <= uint256(r.dueDate) + DEFAULT_GRACE) revert NotDueYet();
        r.status = Status.Defaulted;
        r.flags |= FLAG_EVER_DEFAULTED;
        _stats[r.buyer][r.token].defaults++;
        emit Defaulted(id, r.buyer);
    }

    function claim(address token) external nonReentrant {
        uint256 amount = claimable[msg.sender][token];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, token, amount);
    }

    // ================================================================ holder adjustments

    /// @notice Holder issues a credit note, lowering the amount owed.
    function reduceFace(uint256 id, uint128 reduceBy) external nonReentrant {
        _reduce(id, reduceBy);
    }

    /// @notice Holder forgives the whole remaining balance.
    function release(uint256 id) external nonReentrant {
        Receivable storage r = _receivables[id];
        _reduce(id, r.faceAmount - r.paidAmount);
    }

    // ================================================================ guarantee

    function depositGuarantee(address token, uint128 amount) external nonReentrant {
        if (!tokenAllowed[token]) revert TokenNotAllowed();
        if (amount == 0) revert InvalidAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _guarantees[msg.sender][token].balance += amount;
        emit GuaranteeDeposited(msg.sender, token, amount);
    }

    function withdrawGuarantee(address token, uint128 amount) external nonReentrant {
        Guarantee storage g = _guarantees[msg.sender][token];
        if (amount == 0 || amount > g.balance - g.locked) revert InsufficientGuarantee();
        g.balance -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit GuaranteeWithdrawn(msg.sender, token, amount);
    }

    // ================================================================ profile

    function setProfile(string calldata name_, string calldata domain) external {
        if (bytes(name_).length > 64 || bytes(domain).length > 128) revert StringTooLong();
        _profiles[msg.sender] = Profile(name_, domain);
        emit ProfileSet(msg.sender, name_, domain);
    }

    // ================================================================ admin

    /// @notice Tokens can only be added, never removed, so live receivables are never stranded.
    function allowToken(address token) external onlyOwner {
        _allowToken(token);
    }

    // ================================================================ views

    function getReceivable(uint256 id)
        public
        view
        returns (Receivable memory r, bool overdue, uint128 remaining, address holder)
    {
        r = _receivables[id];
        if (r.status == Status.None) return (r, false, 0, address(0));
        remaining = r.faceAmount - r.paidAmount;
        overdue = (r.status == Status.Accepted || r.status == Status.Defaulted) && block.timestamp > r.dueDate;
        holder = _ownerOf(id);
    }

    function buyerStats(address buyer, address token) external view returns (BuyerStats memory) {
        return _stats[buyer][token];
    }

    function guaranteeOf(address buyer, address token)
        external
        view
        returns (uint128 balance, uint128 locked)
    {
        Guarantee memory g = _guarantees[buyer][token];
        return (g.balance, g.locked);
    }

    function exposure(address holder, address buyer, address token) external view returns (uint128) {
        return _exposure[holder][buyer][token];
    }

    function profileOf(address account) external view returns (string memory name_, string memory domain) {
        Profile storage p = _profiles[account];
        return (p.name, p.domain);
    }

    function countBySupplier(address supplier) external view returns (uint256) {
        return _bySupplier[supplier].length;
    }

    function countByBuyer(address buyer) external view returns (uint256) {
        return _byBuyer[buyer].length;
    }

    function idsBySupplier(address supplier, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _slice(_bySupplier[supplier], offset, limit);
    }

    function idsByBuyer(address buyer, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        return _slice(_byBuyer[buyer], offset, limit);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        (Receivable memory r, bool overdue, uint128 remaining,) = getReceivable(id);
        return DayzroRenderer.render(id, r, overdue, remaining);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, IERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ================================================================ internal: lifecycle

    function _create(
        address supplier,
        address buyer,
        address token,
        uint128 faceAmount,
        uint64 dueDate,
        bytes32 docHash,
        bytes32 ref,
        uint32 flags
    ) internal returns (uint256 id) {
        if (!tokenAllowed[token]) revert TokenNotAllowed();
        if (supplier == address(0) || buyer == address(0) || supplier == buyer) revert InvalidParty();
        if (faceAmount < MIN_FACE) revert InvalidAmount();
        if (dueDate <= block.timestamp || dueDate > block.timestamp + MAX_TENOR) revert InvalidDueDate();

        id = ++totalReceivables;
        _receivables[id] = Receivable({
            supplier: supplier,
            dueDate: dueDate,
            flags: flags,
            buyer: buyer,
            acceptedAt: 0,
            status: Status.Pending,
            token: token,
            issuedAt: uint64(block.timestamp),
            faceAmount: faceAmount,
            paidAmount: 0,
            docHash: docHash,
            ref: ref
        });
        _bySupplier[supplier].push(id);
        _byBuyer[buyer].push(id);
        _mint(supplier, id);
        emit InvoiceCreated(id, supplier, buyer, token, faceAmount, dueDate, docHash, ref);
    }

    function _accept(uint256 id, bool guaranteed) internal {
        Receivable storage r = _receivables[id];
        if (r.status != Status.Pending) revert WrongStatus();
        if (block.timestamp >= r.dueDate) revert InvalidDueDate();

        uint128 face = r.faceAmount;
        if (guaranteed) {
            Guarantee storage g = _guarantees[r.buyer][r.token];
            if (g.balance - g.locked < face) revert InsufficientGuarantee();
            g.locked += face;
            r.flags |= FLAG_GUARANTEED;
        }
        r.status = Status.Accepted;
        r.acceptedAt = uint64(block.timestamp);

        BuyerStats storage s = _stats[r.buyer][r.token];
        s.accepted++;
        s.acceptedVolume += face;
        s.outstanding += face;
        _exposure[_ownerOf(id)][r.buyer][r.token] += face;

        emit Accepted(id, r.buyer, guaranteed);
    }

    function _settle(uint256 id, uint128 amount, uint8 source) internal {
        Receivable storage r = _receivables[id];
        Status status = r.status;
        if (status != Status.Accepted && status != Status.Defaulted) revert WrongStatus();
        uint128 remaining = r.faceAmount - r.paidAmount;
        if (amount > remaining) amount = remaining;
        if (amount == 0) revert InvalidAmount();

        address buyer = r.buyer;
        address token = r.token;
        bool guaranteed = r.flags & FLAG_GUARANTEED != 0;

        // effects: funding source
        if (source == SRC_WALLET) {
            if (guaranteed) _guarantees[buyer][token].locked -= amount;
        } else {
            Guarantee storage g = _guarantees[buyer][token];
            if (guaranteed) {
                g.locked -= amount;
            } else if (g.balance - g.locked < amount) {
                revert InsufficientGuarantee();
            }
            g.balance -= amount;
        }

        // effects: accounting
        address holder = _ownerOf(id);
        r.paidAmount += amount;
        _exposure[holder][buyer][token] -= amount;
        BuyerStats storage s = _stats[buyer][token];
        s.outstanding -= amount;
        s.paidVolume += amount;
        if (amount == remaining) _complete(r, s, id, source);

        // interactions
        if (source == SRC_WALLET) IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        bool pushed = _push(token, holder, amount);
        emit Paid(id, msg.sender, holder, amount, source, pushed);
    }

    function _complete(Receivable storage r, BuyerStats storage s, uint256 id, uint8 source) internal {
        r.status = Status.Paid;
        bool onTime = block.timestamp <= r.dueDate;
        if (source == SRC_GUARANTEE_SETTLE) {
            s.guaranteeSettled++;
        } else if (onTime) {
            s.paidOnTime++;
        } else {
            s.paidLate++;
            s.totalDaysLate += uint64(Math.ceilDiv(block.timestamp - r.dueDate, 1 days));
        }
        emit Settled(id, onTime);
    }

    function _reduce(uint256 id, uint128 reduceBy) internal {
        Receivable storage r = _receivables[id];
        if (_ownerOf(id) != msg.sender) revert NotHolder();
        if (r.status != Status.Accepted && r.status != Status.Defaulted) revert WrongStatus();
        uint128 remaining = r.faceAmount - r.paidAmount;
        if (reduceBy == 0 || reduceBy > remaining) revert InvalidAmount();

        address buyer = r.buyer;
        address token = r.token;
        r.faceAmount -= reduceBy;
        if (r.flags & FLAG_GUARANTEED != 0) _guarantees[buyer][token].locked -= reduceBy;
        _exposure[msg.sender][buyer][token] -= reduceBy;
        BuyerStats storage s = _stats[buyer][token];
        s.outstanding -= reduceBy;
        emit FaceReduced(id, r.faceAmount);

        if (reduceBy == remaining) {
            if (r.paidAmount == 0) {
                r.status = Status.Cancelled;
                emit Cancelled(id);
            } else {
                _complete(r, s, id, SRC_WALLET);
            }
        }
    }

    /// @dev Buyer acquiring its own receivable (e.g. early payment via a facility) extinguishes the debt.
    function _extinguish(uint256 id, address from) internal {
        Receivable storage r = _receivables[id];
        uint128 remaining = r.faceAmount - r.paidAmount;
        address buyer = r.buyer;
        address token = r.token;
        r.paidAmount = r.faceAmount;
        if (r.flags & FLAG_GUARANTEED != 0) _guarantees[buyer][token].locked -= remaining;
        BuyerStats storage s = _stats[buyer][token];
        s.outstanding -= remaining;
        s.paidVolume += remaining;
        _complete(r, s, id, SRC_BUYBACK);
        emit Paid(id, buyer, from, remaining, SRC_BUYBACK, true);
    }

    // ================================================================ internal: transfers

    /// @dev Pending, Paid and Cancelled receivables are soulbound. Exposure follows the holder.
    function _update(address to, uint256 id, address auth) internal override returns (address from) {
        from = _ownerOf(id);
        if (from != address(0) && to != address(0)) {
            Receivable storage r = _receivables[id];
            if (r.status != Status.Accepted && r.status != Status.Defaulted) revert NotTransferable();
            uint128 remaining = r.faceAmount - r.paidAmount;
            _exposure[from][r.buyer][r.token] -= remaining;
            if (to == r.buyer) {
                _extinguish(id, from);
            } else {
                _exposure[to][r.buyer][r.token] += remaining;
            }
        }
        return super._update(to, id, auth);
    }

    /// @dev Push to the holder; if the transfer fails (e.g. USDC blocklist) credit a claimable balance.
    function _push(address token, address to, uint256 amount) internal returns (bool pushed) {
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        pushed = ok && (data.length == 0 || abi.decode(data, (bool)));
        if (!pushed) claimable[to][token] += amount;
    }

    function _allowToken(address token) internal {
        if (token == address(0)) revert TokenNotAllowed();
        tokenAllowed[token] = true;
        emit TokenAllowed(token);
    }

    function _slice(uint256[] storage arr, uint256 offset, uint256 limit)
        internal
        view
        returns (uint256[] memory out)
    {
        uint256 len = arr.length;
        if (offset >= len) return new uint256[](0);
        uint256 end = Math.min(len, offset + limit);
        out = new uint256[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            out[i - offset] = arr[i];
        }
    }
}
