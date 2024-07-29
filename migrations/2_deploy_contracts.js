const Torrents = artifacts.require("Torrents");

module.exports = function(deployer) {
  deployer.deploy(Torrents);
};
