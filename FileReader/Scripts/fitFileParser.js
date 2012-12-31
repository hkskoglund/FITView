// Setup DOM event handling

var outConsole = document.getElementById('outConsole');

// Capturing = false -> bubbling event
var inpFITFile = document.getElementById('inpFITFile');
inpFITFile.addEventListener('change', onFitFileSelected, false);

var fitFileManager = new FitFileManager();

var btnParse = document.getElementById('btnParse')
btnParse.addEventListener('click', fitFileManager.onbtnParseClick, false);

var selectedFiles; // All File thats selected

// User interface events




function onFitFileSelected(e) {
    // console.log(e);
    e.preventDefault();

    selectedFiles = e.target.files;
    fitFileManager.fitFile = selectedFiles[0];

    // To do: check file size

    var btnParse = document.getElementById('btnParse');
    btnParse.style.visibility = 'visible';


}

// Adapted From http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// Ported from C to javascript from FIT SDK 5.10 fit_crc.c
// Accessed: 28 december 2012

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

function FitFileManager(fitFile) {

    var self = this;



    //this.baseTypes = [{ "type" : 0, "field" : 0x00, "name" : "enum", "invalid" : 0xFF},

    /*
      @fitFile - File reference to FIT file from browser
    ***/
    this.fitFile = fitFile;

    /*
      @index - Pointer to next unread byte in FIT file
    ***/

    this.index = 0;


    // Callback from button = this
    this.onbtnParseClick = function (e) {
        //var fitManager = new FitFileManager(selectedFiles[0]);
        self.showFileInfo();
        self.loadFile();
    }

    this.showFileInfo = function () { outConsole.innerHTML = '<p>File size: ' + this.fitFile.size.toString() + ' bytes, last modified: ' + this.fitFile.lastModifiedDate.toLocaleDateString() + '</p>'; }

    /** Callback for loadend event on FileReader
     @param e = ProgressEvent
    ***/
    this.fitFileLoadEnd = function (e) {
        try {
            // self contains a reference to fitFileManager
            self.getFITHeader(self.fitReader.result, self.fitFile.size);
            outConsole.innerHTML += self.toinnerHTML();

            // Start reading records from file
            self.parseRecords();


        } catch (e) {
            console.error('Trouble with FIT file header parsing, message:', e.message);
        }

    }
}

FitFileManager.prototype.parseRecords = function () {
    var aFITBuffer = this.fitReader.result;
    var dvFITBuffer = new DataView(aFITBuffer);

    while (this.index < this.headerSize + this.dataSize) {
        var rec = this.getRecord(dvFITBuffer, this.index);

        // If we got an definition message, store it as a property 
        if (rec.header["messageType"] == 1)
            this["localMsgDefinition" + rec.header["localMessageType"].toString()] = rec;
    }

    //this.littleEndian = firstRecord.content.littleEndian; // The encoding used for records

    // Unclear if last 2 bytes of FIT file is big/little endian, but based on FIT header CRC is stored in little endian, so
    // it should be quite safe to assume the last two bytes is stored in little endian format
    var CRC = this.getFITCRC(aFITBuffer.slice(-2), true);
    console.log("Stored 2-byte is CRC in file is : " + CRC.toString());

    // Not debugged yet...var verifyCRC = fitCRC(dvFITBuffer, 0, this.headerSize + this.dataSize, 0);

}


FitFileManager.prototype.loadFile = function () {
    this.fitReader = new FileReader();
    this.fitReader.addEventListener('loadend', this.fitFileLoadEnd, false);

    try {
        this.fitReader.readAsArrayBuffer(this.fitFile);

    } catch (e) {
        console.error('Could not initialize fit file reader with bytes, message:', e.message);
    }
}

FitFileManager.prototype.getFITCRC = function (aCRCBuffer, littleEndian) {
    var dviewFITCRC = new DataView(aCRCBuffer); // Last 2 bytes of .FIT file contains CRC
    return dviewFITCRC.getUint16(0, littleEndian);

}

FitFileManager.prototype.getFITHeader = function (bufFitHeader, fitFileSystemSize) {

    var MAXFITHEADERLENGTH = 14; // FIT Protocol rev 1.3 p. 13

    var dviewFitHeader = new DataView(bufFitHeader);
    // DataView defaults to bigendian MSB --- LSB
    // FIT file header protocol v. 1.3 stored as little endian

    this.headerSize = dviewFitHeader.getUint8(0);


    this.protocolVersion = dviewFitHeader.getUint8(1);       // FIT SDK v5.1 - fit.h - 4-bit MSB = major - 4-bit LSB = minor
    this.protocolVersionMajor = this.protocolVersion >> 4;
    this.protocolVersionMinor = this.protocolVersion & 0x0F;

    this.profileVersion = dviewFitHeader.getUint16(2, true); // FIT SDK v5.1: - fit h. -  major*100+minor
    this.profileVersionMajor = Math.floor(this.profileVersion / 100);
    this.profileVersionMinor = this.profileVersion - (this.profileVersionMajor * 100);

    this.dataSize = dviewFitHeader.getUint32(4, true);

    var estimatedFitFileSize = this.headerSize + this.dataSize + 2;  // 2 for last CRC
    if (estimatedFitFileSize != fitFileSystemSize)
        console.warn("Header reports FIT file size " + estimatedFitFileSize.toString() + " bytes, but file system reports: " + fitFileSystemSize.toString() + " bytes.");

    this.dataType = ab2str(bufFitHeader.slice(8, 12)); // Should be .FIT ASCII codes

    this.index = 12;

    // Optional header info

    if (this.headerSize >= MAXFITHEADERLENGTH) {
        this.headerCRC = dviewFitHeader.getUint16(12, true);
        this.index += 2;
        if (this.headerCRC === 0)
            console.info("Header CRC was not stored in file");

    }



}

FitFileManager.prototype.toinnerHTML = function () {
    var headerHtml = '<p>Header size : ' + this.headerSize.toString() + ' bytes ' +
'Protocol version : ' + this.protocolVersion.toString() +
' Profile version : ' + this.profileVersion.toString() +
' Data size: ' + this.dataSize.toString() + ' bytes' +
' Data type: ' + this.dataType;
    if (this.headerCRC != undefined) {
        headerHtml += ' CRC: ' + parseInt(this.headerCRC, 10).toString(16);
    }

    return headerHtml;
}

FitFileManager.prototype.getRecord = function (dviewFit) {

    // From table 4-6 p. 22 in D00001275 Flexible & Interoperable Data Transfer (FIT) Protocol Rev 1.3

    var fitBaseTypesInvalidValues = {};
    fitBaseTypesInvalidValues[0x00] = {
        "name": "enum",
        "invalidValue": 0xFF
    }
    fitBaseTypesInvalidValues[0x01] = {
        "name": "sint8",
        "invalidValue": 0x7F
    }
    fitBaseTypesInvalidValues[0x02] = {
        "name": "uint8",
        "invalidValue": 0xFF
    }
    fitBaseTypesInvalidValues[0x83] = {
        "name": "sint16",
        "invalidValue": 0x7FFF
    }
    fitBaseTypesInvalidValues[0x84] = {
        "name": "uint16",
        "invalidValue": 0xFFFF
    }
    fitBaseTypesInvalidValues[0x85] = {
        "name": "sint32",
        "invalidValue": 0x7FFFFFFF
    }
    fitBaseTypesInvalidValues[0x86] = {
        "name": "uint32",
        "invalidValue": 0xFFFFFFFF
    }
    fitBaseTypesInvalidValues[0x07] = {
        "name": "string",
        "invalidValue": 0x00
    }
    fitBaseTypesInvalidValues[0x88] = {
        "name": "float32",
        "invalidValue": 0xFFFFFFFF
    }
    fitBaseTypesInvalidValues[0x89] = {
        "name": "float64",
        "invalidValue": 0xFFFFFFFFFFFFFFFF
    }

    fitBaseTypesInvalidValues[0x0A] = {
        "name": "uint8z",
        "invalidValue": 0x00
    }
    fitBaseTypesInvalidValues[0x8B] = {
        "name": "uint16z",
        "invalidValue": 0x0000
    }
    fitBaseTypesInvalidValues[0x8C] = {
        "name": "uint32z",
        "invalidValue": 0x00000000
    }
    fitBaseTypesInvalidValues[0x0D] = {
        "name": "byte",
        "invalidValue": 0xFF
    }



    var recHeader = {};
    var recContent = {};
    var record = {};

    var DEFINITION_MSG = 1;
    var DATA_MSG = 0;

    // HEADER

    var HEADERTYPE_FLAG = 0x80;                // binary 10000000 
    var NORMAL_MESSAGE_TYPE_FLAG = 0x40;       // binary 01000000
    var NORMAL_LOCAL_MESSAGE_TYPE_FLAGS = 0xF; // binary 00001111

    // Data message time compressed
    var TIMEOFFSET_FLAGS = 0x1F;                           // binary 00011111 
    var COMPRESSED_TIMESTAMP_LOCAL_MESSAGE_TYPE_FLAGS = 0x60; // binary 01100000 

    recHeader["byte"] = dviewFit.getUint8(this.index++);
    recHeader["headerType"] = (recHeader["byte"] & HEADERTYPE_FLAG) >> 7 // MSB 7 0 = normal header, 1 = compressed timestampheader

    switch (recHeader["headerType"]) {
        case 0: // Normal header
            recHeader["messageType"] = (recHeader["byte"] & NORMAL_MESSAGE_TYPE_FLAG) >> 6; // bit 6 - 1 = definition, 0 = data msg.
            // bit 5 = 0 reserved
            // bit 4 = 0 reserved
            recHeader["localMessageType"] = recHeader["byte"] & NORMAL_LOCAL_MESSAGE_TYPE_FLAGS; // bit 0-3

            break;
        case 1: // Compressed timestamp header - only for data records
            recHeader["localMessageType"] = (recHeader["byte"] & COMPRESSED_TIMESTAMP_LOCAL_MESSAGE_TYPE_FLAGS) >> 5;
            recHeader["timeOffset"] = (recHeader["byte"] & TIMEOFFSET_FLAGS); // bit 0-4 - in seconds since a fixed reference start time (max 32 secs)
            break;

    }

    record["header"] = recHeader;
    console.log("Header type: " + recHeader["headerType"] + " Local message type: " + recHeader["localMessageType"].toString());

    // VARIALE CONTENT, EITHER DATA OR DEFINITION

    switch (recHeader["messageType"]) {
        case DEFINITION_MSG:
            //  5 byte FIXED content header
            recContent["reserved"] = dviewFit.getUint8(this.index++); // Reserved = 0
            recContent["littleEndian"] = dviewFit.getUint8(this.index++) == 0; // 0 = little endian 1 = big endian (javascript dataview defaults to big endian!)
            recContent["globalMsgNr"] = dviewFit.getUint16(this.index, recContent["littleEndian"]); // what kind of data message
            this.index = this.index + 2;
            recContent["fieldNumbers"] = dviewFit.getUint8(this.index++); // Number of fields in data message

            // VARIABLE content - field definitions as properties

            for (var i = 0; i < recContent["fieldNumbers"]; i++)
                recContent["field" + i.toString()] = {
                    "fieldDefinitionNumber": dviewFit.getUint8(this.index++),
                    "size": dviewFit.getUint8(this.index++),
                    "baseType": dviewFit.getUint8(this.index++)
                }

            console.log("Definition message, global message nr. = ", recContent["globalMsgNr"].toString() + " contains " + recContent["fieldNumbers"].toString() + " fields");

            break;

        case DATA_MSG: // Lookup in msg. definition in properties -> read fields
            var localMsgDefinition = this["localMsgDefinition" + recHeader["localMessageType"].toString()]
            if (localMsgDefinition == undefined || localMsgDefinition == null)
                throw new Error("Could not find message definition of data message");

            // Loop through all field definitions and read corresponding fields in data message

            var littleEndian = localMsgDefinition["content"].littleEndian;

            // var logging = "";
            for (var i = 0; i < localMsgDefinition["content"].fieldNumbers; i++) {
                var bType = localMsgDefinition.content["field" + i.toString()].baseType;
                if (fitBaseTypesInvalidValues[bType] == undefined || fitBaseTypesInvalidValues[bType] == null)
                    console.log("Base type not found for base type" + bType);
                //  logging += fitBaseTypesInvalidValues[bType].name+" ";
                // Just skip reading values at the moment...
               // this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;

                switch (bType) {
                    case 0x00: recContent["field" + i.toString()] = { "value": dviewFit.getUint8(this.index++) }; break;
                    case 0x0A: recContent["field" + i.toString()] = { "value": dviewFit.getUint8(this.index++) }; break;
                    case 0x01: recContent["field" + i.toString()] = { "value": dviewFit.getInt8(this.index++) }; break;
                    case 0x02: recContent["field" + i.toString()] = { "value": dviewFit.getUint8(this.index++) }; break;
                    case 0x83: recContent["field" + i.toString()] = { "value": dviewFit.getInt16(this.index, littleEndian) }; this.index += 2; break;
                    case 0x84: recContent["field" + i.toString()] = { "value": dviewFit.getUint16(this.index, littleEndian) }; this.index += 2; break;
                    case 0x8B: recContent["field" + i.toString()] = { "value": dviewFit.getUint16(this.index, littleEndian) }; this.index += 2; break;
                    case 0x85: recContent["field" + i.toString()] = { "value": dviewFit.getInt32(this.index, littleEndian) }; this.index += 4; break;
                    case 0x86: recContent["field" + i.toString()] = { "value": dviewFit.getUint32(this.index, littleEndian) }; this.index += 4; break;
                    case 0x8C: recContent["field" + i.toString()] = { "value": dviewFit.getUint32(this.index, littleEndian) }; this.index += 4; break;
                    case 0x07: console.log("String not implemented yet!");
                        //recContent["field" + i.toString()] = { "value" : dviewFit.getUint8(this.index++) }; break; // FIX IT LATER!!! Null terminated string? of 1 byte
                        this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
                        break;
                    case 0x88: recContent["field" + i.toString()] = { "value": dviewFit.getFloat32(this.index, littleEndian) }; this.index += 4; break;
                    case 0x89: recContent["field" + i.toString()] = { "value": dviewFit.getFloat64(this.index, littleEndian) }; this.index += 8; break;
                    case 0x0D: console.log("Array of bytes not implemented yet!");
                        //recContent["field" + i.toString()] = { "value" : dviewFit.getUint8(this.index++) }; break; // ARRAY OF BYTES FIX
                        this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
                        break;
                    default: //throw new Error("Base type " + bType.toString() + " not found in lookup switch"); break;
                        console.error("Base type " + bType.toString() + " not found in lookup switch");
                        this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
                        break;
                }
            }

            //console.log(logging);

            break;
    }

    record["content"] = recContent;

    return record;
}
