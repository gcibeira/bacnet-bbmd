const BACnetBBMD = require('./bacnet-bbmd');

const bbmd = new BACnetBBMD({
    broadcastAddress:'192.168.10.255',      // Local subnet broadcast address
    port:47808,                             // BACnet UDP port
    bdt:[{address:'192.168.11.101:47809'}], // Broadcast Distribution Table
    fdt:[],                                 // Foreign devices Distribution Table
    bbmdPort:47809                          // Self UDP port to listen to other BBMDs and Foreign devices
});

console.log("server running...");