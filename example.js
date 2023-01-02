const BACnetBBMD = require('./bacnet-bbmd');
const bbmd = new BACnetBBMD({
    broadcastAddress:'192.168.10.255',
    port:47808,
    bdt:[{address:'192.168.11.101:47809'}],
    bbmdPort:47809
});

console.log("server running...");