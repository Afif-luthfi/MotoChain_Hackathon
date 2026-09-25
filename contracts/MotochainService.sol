// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MotochainService {
    uint256 public constant WORKFLOW_VERSION = 2;
    enum Status { Pending, Confirmed, Rejected }
    struct Motor { address owner; bytes32 digest; string uri; uint64 createdAt; }
    struct Record { uint256 motorId; address issuer; bytes32 digest; string uri; Status status; uint64 submittedAt; uint64 decidedAt; }
    uint256 public motorCount;
    uint256 public recordCount;
    mapping(uint256 => Motor) private motors;
    mapping(uint256 => Record) private records;
    mapping(address => uint256[]) private ownerMotors;
    mapping(uint256 => uint256[]) private motorRecords;

    event MotorRegistered(uint256 indexed motorId, address indexed owner, bytes32 digest);
    event ServiceSubmitted(uint256 indexed motorId, uint256 indexed recordId, address indexed issuer, bytes32 digest);

    modifier onlyOwner(uint256 motorId) {
        require(motors[motorId].owner == msg.sender, "Owner only"); _;
    }
    function checkMetadata(bytes32 digest, string calldata uri) private pure {
        require(digest != bytes32(0), "Empty digest");
        require(bytes(uri).length > 0 && bytes(uri).length <= 300, "Invalid URI");
    }
    function registerMotor(bytes32 digest, string calldata uri) external returns (uint256 id) {
        checkMetadata(digest, uri);
        id = ++motorCount;
        motors[id] = Motor(msg.sender, digest, uri, uint64(block.timestamp));
        ownerMotors[msg.sender].push(id);
        emit MotorRegistered(id, msg.sender, digest);
    }
    function submitService(uint256 motorId, bytes32 digest, string calldata uri) external onlyOwner(motorId) returns (uint256 id) {
        checkMetadata(digest, uri);
        id = ++recordCount;
        records[id] = Record(motorId, msg.sender, digest, uri, Status.Confirmed, uint64(block.timestamp), uint64(block.timestamp));
        motorRecords[motorId].push(id);
        emit ServiceSubmitted(motorId, id, msg.sender, digest);
    }
    function getMotor(uint256 id) external view returns (Motor memory) {
        require(motors[id].owner != address(0), "Unknown motor"); return motors[id];
    }
    function getRecord(uint256 id) external view returns (Record memory) {
        require(records[id].issuer != address(0), "Unknown record"); return records[id];
    }
    function ownerMotorIds(address owner, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return page(ownerMotors[owner], offset, limit);
    }
    function serviceIds(uint256 motorId, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return page(motorRecords[motorId], offset, limit);
    }
    function page(uint256[] storage values, uint256 offset, uint256 limit) private view returns (uint256[] memory result) {
        require(limit > 0 && limit <= 100, "Invalid page size");
        if (offset >= values.length) return new uint256[](0);
        uint256 length = values.length - offset;
        if (length > limit) length = limit;
        result = new uint256[](length);
        for (uint256 i; i < length; ++i) result[i] = values[offset + i];
    }
}
