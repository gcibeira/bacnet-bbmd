# BACnet BBMD
A NodeJS module that extends the Client class of the [node-backstack](https://github.com/BiancoRoyal/node-bacstack) module to add BBMD funtionalities.

It works by listening UDP traffic in the local subnet, reading the BVLC header looking for an "original broadcast" message, wraping it into a "forwarded NPDU" packet and sending a unicast messagge to each BBMD and Foreign device listed in the BDT and FDT tables. And vice versa, it unwraps unicast messages received from other BBMDs and replicates the broadcast message in its local subnet.

It adds an aditional UDP socket (with different port number) to manage unicast messages from/to other BBMDs.
It overrides the _receiveData() method from the Client class (which handles the 'on message' event) so it can call the corresponding method in case of receiving an "original broadcast" message.

It also passes the message to the upper layers, so you can build your BACnet application on top of it, i.e. client or device/server.


At the moment you have to specifie the BDT and FDT manually, as it doesn't handle the "Read/Write BDT" messages.

## Usage

The module includes the following example.js file:

``` js
const BACnetBBMD = require('./bacnet-bbmd');

const bbmd = new BACnetBBMD({
    broadcastAddress:'192.168.10.255',      // Local subnet broadcast address
    port:47808,                             // BACnet UDP port
    bdt:[{address:'192.168.11.101:47809'}], // Broadcast Distribution Table
    fdt:[],                                 // Foreign devices Distribution Table
    bbmdPort:47809                          // Self UDP port to listen to other BBMDs and Foreign devices
});

console.log("server running...");
```

## TO DO list:
- Implement Broadcast mask in BDT
- Implement Read/Write BDT function
- Implement Read FDT function
- Implement Register/Delete Foreign Device
- Implement handling "Distribute Broadcast to Network" message
- Improve comments and documentation

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2023 Gerardo D. Cibeira

Bacstack library by:
Copyright (c) 2018-2020 Community Driven

Copyright (c) 2017-2019 Fabio Huser

**Note:** This is not an official product of the BACnet Advocacy Group.
BACnet® is a registered trademark of American Society of Heating, Refrigerating and
Air-Conditioning Engineers (ASHRAE).
