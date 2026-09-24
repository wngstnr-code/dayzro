// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IDayzroRegistry is IERC721 {
    enum Status {
        None,
        Pending,
        Accepted,
        Paid,
        Cancelled,
        Defaulted
    }

    struct Receivable {
        address supplier;
        uint64 dueDate;
        uint32 flags;
        address buyer;
        uint64 acceptedAt;
        Status status;
        address token;
        uint64 issuedAt;
        uint128 faceAmount;
        uint128 paidAmount;
        bytes32 docHash;
        bytes32 ref;
    }

    struct BuyerStats {
        uint32 accepted;
        uint32 paidOnTime;
        uint32 paidLate;
        uint32 defaults;
        uint32 guaranteeSettled;
        uint64 totalDaysLate;
        uint128 acceptedVolume;
        uint128 paidVolume;
        uint128 outstanding;
    }

    function getReceivable(uint256 id)
        external
        view
        returns (Receivable memory r, bool overdue, uint128 remaining, address holder);

    function exposure(address holder, address buyer, address token) external view returns (uint128);

    function tokenAllowed(address token) external view returns (bool);
}
