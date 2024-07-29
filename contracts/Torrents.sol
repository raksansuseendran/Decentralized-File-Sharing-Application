// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Torrent {
    struct File {
        address owner;
        uint cost;
        bytes32 torrentMapHash;
        mapping(address => bool) seeders;
    }

    mapping(bytes32 => File) public files;

    event FileUploaded(bytes32 fileId, address owner, uint cost, bytes32 torrentMapHash);
    event FileDownloaded(bytes32 fileId, address seeder, uint payment);

    modifier onlyOwner(bytes32 fileId) {
        require(msg.sender == files[fileId].owner, "Only the owner can perform this action");
        _;
    }

    function uploadFile(bytes32 fileId, uint cost, bytes32 torrentMapHash) external {
        require(files[fileId].owner == address(0), "File already exists");
        files[fileId] = File(msg.sender, cost, torrentMapHash);
        emit FileUploaded(fileId, msg.sender, cost, torrentMapHash);
    }

    function downloadFile(bytes32 fileId) external payable {
        File storage file = files[fileId];
        require(msg.value >= file.cost, "Insufficient payment");

        // Distribute payment to seeders
        uint seederCount = getSeederCount(fileId);
        uint seederPayment = msg.value / (1 + seederCount);
        payable(file.owner).transfer(seederPayment);
        emit FileDownloaded(fileId, file.owner, seederPayment);

        // Update seeder list
        file.seeders[msg.sender] = true;
    }

    function getTorrentMap(bytes32 fileId) external view returns (bytes32) {
        return files[fileId].torrentMapHash;
    }

    function getSeederCount(bytes32 fileId) internal view returns (uint) {
        uint count = 0;
        for (uint i = 0; i < files[fileId].seeders.length; i++) {
            if (files[fileId].seeders[i]) {
                count++;
            }
        }
        return count;
    }

    function isSeeder(bytes32 fileId, address seeder) external view returns (bool) {
        return files[fileId].seeders[seeder];
    }
}
