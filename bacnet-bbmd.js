//
// BACnet BBMD implementation.
//

const bacnet = require('node-bacnet');
const debug = require('debug')('bacnet-bbmd');
const trace = require('debug')('bacnet:bbmd:trace');

// Local Modules

const baServices        = require('./node_modules/node-bacnet/lib/services');
const baBvlc            = require('./node_modules/node-bacnet/lib/bvlc');
const baEnum            = require('./node_modules/node-bacnet/lib/enum');
const baTransport       = require('./node_modules/node-bacnet/lib/transport');
const DEFAULT_BBMD_PORT = 47809;

class BACnetBBMD extends bacnet{
    constructor(options) {
        super(options);
    
        //BDT table. e.g. [{address:'192.168.15.10:47809',mask:'255.255.255.255'}, {address:'192.168.30.5',mask:'255.255.255.255'}];
        this._bdt = options.bdt || [];
        //FDT table. e.g. [{address:'10.8.8.30:47808',TTL:60,Remain:26}, {address:'192.168.50.11',TTL:60,Remain:26}];
        this._fdt = options.fdt || [];

        this._bbmdSocket = this._settings.bbmdSocket || new baTransport({
          port: options.bbmdPort || DEFAULT_BBMD_PORT,
          interface: this._settings.interface,
        });
    
        // Setup code
        this._bbmdSocket.on('message', this._handleForwarded.bind(this));
        this._bbmdSocket.on('error', this._receiveError.bind(this));
        this._bbmdSocket.on('listening', () => this.emit('listening'));
        this._bbmdSocket.open();
      }

      //Override _receiveData() method from parent, so we can handle broadcast and forwarding
      _receiveData(buffer, remoteAddress) {
        // Check data length
        if (buffer.length < baBvlc.BVLC_HEADER_LENGTH) return debug.trace('Received invalid data -> Drop package');
        // Parse BVLC header
        const result = baBvlc.decode(buffer, 0);
        if (!result) return debug.trace('Received invalid BVLC header -> Drop package');
        let header = {
          // Which function the packet came in on, so later code can distinguish
          // between ORIGINAL_BROADCAST_NPDU and DISTRIBUTE_BROADCAST_TO_NETWORK.
          func: result.func,
          sender: {
            // Address of the host we are directly connected to. String, IP:port.
            address: remoteAddress,
            // If the host is a BBMD passing messages along to another node, this
            // is the address of the distant BACnet node.  String, IP:port.
            // Typically we won't have network connectivity to this address, but
            // we have to include it in replies so the host we are connect to knows
            // where to forward the messages.
            forwardedFrom: null,
          },
        };
        // Check BVLC function
        switch (result.func) {
          case baEnum.BvlcResultPurpose.ORIGINAL_UNICAST_NPDU:
          case baEnum.BvlcResultPurpose.ORIGINAL_BROADCAST_NPDU:
            this._handleNpdu(buffer, result.len, buffer.length - result.len, header);
            this._handleBroadcast(buffer, result.len, remoteAddress);
            break;
          case baEnum.BvlcResultPurpose.FORWARDED_NPDU:
            // Preserve the IP of the node behind the BBMD so we know where to send
            // replies back to.
            header.sender.forwardedFrom = result.originatingIP;
            this._handleNpdu(buffer, result.len, buffer.length - result.len, header);
            break;
          case baEnum.BvlcResultPurpose.REGISTER_FOREIGN_DEVICE:
            let decodeResult = baServices.registerForeignDevice.decode(buffer, result.len, buffer.length - result.len);
            if (!decodeResult) return debug.trace('Received invalid registerForeignDevice message');
            this.emit('registerForeignDevice', {
              header: header,
              payload: decodeResult,
            });
            break;
          case baEnum.BvlcResultPurpose.DISTRIBUTE_BROADCAST_TO_NETWORK:
            this._handleNpdu(buffer, result.len, buffer.length - result.len, header);
            break;
          default:
            debug('Received unknown BVLC function ' + result.func + ' -> Drop package');
            break;
        }
      }


    /**
    *
    * @param buffer the content of the message
    * @private
    */
    _handleForwarded(buffer) {
      const result = baBvlc.decode(buffer, 0);
      if(buffer.length < baBvlc.BVLC_HEADER_LENGTH || result.func != baEnum.BvlcResultPurpose.FORWARDED_NPDU){
        return debug.trace('Received invalid BVLC header -> Drop package');
      }
      this._transport.send(buffer,buffer.length,this._settings.broadcastAddress);
    }
    
    
    /**
    *
    * @param buffer the content of the message
    * @param offset where the message begins (i.e. the header's lenght)
    * @param originatingIP the source Address
    * @private
    */
    _handleBroadcast(buffer, offset, originatingIP) {
    // Check data length
    if (buffer.length - offset <= 0) {
        return trace('No NPDU data -> Drop package');
    }
    // Check if there's someone to forward the messagge to
    if(this._bdt.length + this._fdt.length <= 0){
        return trace('No BBMDs or Foreign Devices subscribed -> Drop package');
    }

    const newBuffer = this._getBuffer(true);
    buffer.copy(newBuffer.buffer,newBuffer.offset,offset);
    newBuffer.offset += buffer.length - offset;
    baBvlc.encode(newBuffer.buffer,baEnum.BvlcResultPurpose.FORWARDED_NPDU,newBuffer.offset,originatingIP);
    console.log("forwarding broadcast. Buffer: ", newBuffer);
    for(const bbmd of this._bdt){
        //TODO calc address with mask
        const address = bbmd.address;
        this._bbmdSocket.send(newBuffer.buffer,newBuffer.offset,address);
    }

    for(const fd of this._fdt){
        this._bbmdSocket.send(newBuffer.buffer,newBuffer.offset,fd.address);
    }
  }

}

module.exports = BACnetBBMD