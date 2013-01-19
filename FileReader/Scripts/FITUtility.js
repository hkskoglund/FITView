function FITUtility() {
    var expose = {};

    var d = new Date();
    var timezoneOffset = d.getTimezoneOffset()*-60000; // in milliseconds

    var MIN = 0x10000000;
    // Date.UTC(1989,11,31) - Date.UTC(1970,0,1)
    var OFFSET = 631065600000; // Offset between Garmin (FIT) time and Unix time in ms (Dec 31, 1989 - 00:00:00 January 1, 1970).


    // Garmin datetime = seconds since UTC 00:00 Dec 31 1989
    // If Garmin date_time is < 0x10000000 then it is system time (seconds from device power on)


    // Private functions, maybe exposed later
    function fitCRC_Get16(crc, byte) {
        var crc_table =
         [
           0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
           0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
         ];

        var tmp;

        // compute checksum of lower four bits of byte
        tmp = crc_table[crc & 0xF];
        crc = (crc >> 4) & 0x0FFF;
        crc = crc ^ tmp ^ crc_table[byte & 0xF];

        // now compute checksum of upper four bits of byte
        tmp = crc_table[crc & 0xF];
        crc = (crc >> 4) & 0x0FFF;
        crc = crc ^ tmp ^ crc_table[(byte >> 4) & 0xF];

        return crc;
    }

    function fitCRC(payloadview, start, end, crcSeed) {
        var crc = crcSeed;

        for (var i = start; i <= end; i++) {
            crc = fitCRC_Get16(crc, payloadview.getUint8(i));
        }

        return crc;

    }

    // Adapted From http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }


    expose.addTimezoneOffsetToUTC = function (utc_timestamp)
    {
        return utc_timestamp + timezoneOffset;
    }

   
    
    expose.convertTimestampToUTC = function (timestamp) {
        
        return timestamp * 1000 + OFFSET; // millisec.
      
    }

    expose.convertTimestampToLocalTime = function (timestamp) {
        return timestamp * 1000 + OFFSET + timezoneOffset; // millisec.
    }


    expose.getTimezoneOffsetFromUTC = function () {
        return timezoneOffset;
    }



    expose.semiCirclesToDegrees = function (semicircles) {
        return semicircles * 180 / 2147483648;  // 2 147 483 648 = 2^31
    }

    return expose;
}