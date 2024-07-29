var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var abi = [
    // ABI of your smart contract
    // Paste your ABI here
];
var contractAddress = '0x4EC4120B88bDb04D8515FA855B6b46daC9773A7c'; // Address of your smart contract
var TorrentsContract = new web3.eth.Contract(abi, contractAddress);

// Include this function in app.js to get the fileId based on the file hash
async function getFileIdByHash(fileHash) {
    for (let i = 0; i < files.length; i++) {
        if (files[i].hash === fileHash) {
            return i;
        }
    }
    return null;
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('uploadButton').addEventListener('click', uploadFile);
    document.getElementById('listButton').addEventListener('click', listFiles);

    // Populate Ganache addresses in the select dropdown
    web3.eth.getAccounts().then(function(accounts) {
        var addressSelect = document.getElementById('addressSelect');
        accounts.forEach(function(address, index) {
            var option = document.createElement('option');
            option.text = address;
            option.value = address;
            addressSelect.add(option);
        });

        // Change default account based on selected address
        addressSelect.addEventListener('change', function() {
            web3.eth.defaultAccount = addressSelect.value;
        });
    });
});

async function uploadToIPFS(fileContent) {
    const formData = new FormData();
    formData.append('file', new Blob([fileContent]));

    const response = await fetch('http://localhost:5001/api/v0/add', {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();
    return data.Hash;
}

async function getSeeders(fileHash) {
    var seeders = [];
    const fileId = await TorrentsContract.methods.fileId().call();
    for (var i = 0; i < fileId; i++) {
        const file = await TorrentsContract.methods.files(i).call();
        if (file.hash === fileHash) {
            seeders.push(file.owner);
        }
    }
    return seeders;
}

async function uploadFile() {
    var fileInput = document.getElementById('fileInput');
    var file = fileInput.files[0];
    var reader = new FileReader();

    reader.onload = async function(event) {
        var fileContent = event.target.result;
        var fileName = file.name;
        var fileSize = file.size;

        try {
            var fileHash = await uploadToIPFS(fileContent);

            // Use the selected address as the "from" address  
            var from = web3.eth.defaultAccount;
            if (!from) {
                console.error('No accounts found');
                return;
            }

            TorrentsContract.methods.uploadFile(fileName, fileSize, fileHash).send({from: from, gas: 2000000})
                .then(async function(receipt){
                    console.log('File uploaded successfully. Transaction receipt:', receipt);
                    document.getElementById('status').innerText = 'File uploaded successfully.';
                    console.log('File Name: ' + fileName + '\nFile Size: ' + fileSize + ' bytes\nFile Hash: ' + fileHash + '\nOwner: ' + from);

                    // Create torrent map file
                    var seeders = await getSeeders(fileHash);
                    var torrentMap = {
                        route: `http://localhost:5001/api/v0/cat?arg=${fileHash}`,
                        seeders: seeders
                    };
                    var torrentMapHash = await uploadToIPFS(JSON.stringify(torrentMap));
                    console.log('Torrent map file created. Torrent Map Hash:', torrentMapHash);
                    TorrentsContract.methods.uploadTorrentmapFile(fileHash, torrentMapHash).send({from: from, gas: 2000000})
                        .then(async function(receipt){
                            console.log('Torrent map uploaded successfully. Transaction receipt:', receipt);
                            document.getElementById('status').innerText = 'Torrent map uploaded successfully.';
                            console.log('Torrent Map Hash:', torrentMapHash);
                        })
                        .catch(function(error){
                            console.error('Error uploading torrent map:', error);
                            document.getElementById('status').innerText = 'Error uploading torrent map. See console for details.';
                        });
                })
                .catch(function(error){
                    console.error('Error uploading file:', error);
                    document.getElementById('status').innerText = 'Error uploading file. See console for details.';
                });
        } catch (error) {
            console.error('Error uploading file to IPFS:', error);
            document.getElementById('status').innerText = 'Error uploading file to IPFS. See console for details.';
        }
    };

    reader.readAsArrayBuffer(file);
}

async function listFiles() {
    var files = [];
    try {
        const fileId = await TorrentsContract.methods.fileId().call();
        for (var i = 0; i < fileId; i++) {
            const file = await TorrentsContract.methods.files(i).call();
            torrentMapHash = await TorrentsContract.methods.getTorrentMap(file.hash).call();
            
            var fileObject = {
                name: file.name,
                size: file.size,
                hash: file.hash,
                owner: file.owner,
                torrentMap:torrentMapHash
            };
            files.push(fileObject);
        }
        
        // Display files in the frontend
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var fileElement = document.createElement('li');
            fileElement.innerHTML = 'Name: ' + file.name + '<br>Size: ' + file.size + ' bytes<br>Hash: ' + file.hash + '<br>Owner: ' + file.owner + '<br>Torrent Map: ' + file.torrentMap;
            document.getElementById('fileList').appendChild(fileElement);
            // download button for each file
            var downloadButton = document.createElement('button');
            downloadButton.innerText = 'Download';

            // read torrent map file associated with the file
            downloadButton.addEventListener('click', async function() {
                var ipfsUrl = 'http://localhost:8000/' + file.torrentMap;
                window.open(ipfsUrl, '_blank');
                
                try {
                    const fileId = await getFileIdByHash(file.hash);
                    if (fileId !== null) {
                        await TorrentsContract.methods.downloadFile(file.hash).send({ from: web3.eth.defaultAccount, value: web3.utils.toWei('1', 'ether') });
                        console.log('File downloaded and payment completed successfully');
                    }
                } catch (error) {
                    console.error('Error downloading file and making payment:', error);
                }
            });

            fileElement.appendChild(downloadButton);

            // Add a line break after each file
        }
    } catch (error) {
        console.error('Error getting files:', error);
        document.getElementById('fileList').innerText = 'Error getting files. See console for details.';
    }
}
