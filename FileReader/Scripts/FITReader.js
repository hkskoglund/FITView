//use strict
// Will load "Script/FITMessage.js probably since worker is loaded from /Scripts directory
importScripts('FITMessage.js', 'FITUtility.js');  
var fitFileManager;

var workerThreadContext = self;

// self = dedicatedWorkerContext
// console = undefined in worker -> comment out console.* msg

self.addEventListener('message', function (e) {
    // We get an MessageEvent of type message = e
    var data = e.data;

    if (data.request === undefined) {
        self.postMessage("Unrecognized command!");
        return;
    }

    switch (data.request) {

        case 'loadFitFile':
            var options = {
                fitfile: data.fitfile,
               
                query: data.query,
                skiptimestamps: data.skipTimestamps
            };

            fitFileManager = new FitFileManager(options);
            break;
        default:
            self.postMessage('Unrecongized command' + data.request);
            break;
    }

  
},false);


function FitFileManager(options) {

    this.fitFile = options.fitfile; // Reference to FIT file in browser - FILE API
    this.index = 0; // Pointer to next unread byte in FIT file
    this.records = []; // Holds every global message nr. contained in FIT file
    this.fileBuffer = {};

   
    this.query = options.query;
    

    this.event_type = {
        start: 0,
        stop: 1,
        consecutive_depreciated: 2,
        marker: 3,
        stop_all: 4,
        begin_depreciated: 5,
        end_depreciated: 6,
        end_all_depreciated: 7,
        stop_disable: 8,
        stop_disable_all: 9
    };

    this.fitFileReader = new FileReaderSync(); // For web worker
   
    try {
        this.fileBuffer = this.fitFileReader.readAsArrayBuffer(this.fitFile);
        
    } catch (e) {
        //console.error('Could not initialize fit file reader with bytes, message:', e.message);
    }

    this.headerInfo = this.getFITHeader(this.fileBuffer, this.fitFile.size);

    self.postMessage({ response: "header", header: this.headerInfo });

    
    var rawData = {};

    var rawData = this.getDataRecords(this.query);
    
    self.postMessage({ response: "rawData", "rawdata": rawData, datamessages: this.records  });
}

                                                
FitFileManager.prototype.getDataRecords = function (query) {
    var util = FITUtility();
    var aFITBuffer = this.fileBuffer;
    var dvFITBuffer = new DataView(aFITBuffer);

    var prevIndex = this.index; // If getDataRecords are called again it will start just after header again

    var data = {};

    for (var queryNr = 0; queryNr < query.length; queryNr++) {
        data[query[queryNr].message] = {};
    }

    if (this.headerInfo == undefined)
        return undefined;

    while (this.index < this.headerInfo.headerSize + this.headerInfo.dataSize) {
        var rec = this.getRecord(dvFITBuffer, this.index);

        // If we got an definition message, store it as a property 
        if (rec.header.messageType === 1)
            this["localMsgDefinition" + rec.header.localMessageType.toString()] = rec;
        else {
            var rec = this.getDataRecordContent(rec); // Data record RAW from device - no value conversion (besides scale and offset adjustment)

            this.records.push(rec.globalMessageType); // Store all data globalmessage types contained in FIT file


            for (var queryNr = 0; queryNr < query.length; queryNr++) { // Allow query of more than one message, i.e record session lap
                if (rec.message === query[queryNr].message) {  // only look for specfic messages



                    var fields = query[queryNr].fields.split(" "); // Filters format f1 f2 f3 ... fn
                    //console.log("Request for raw data filtering on message : " + msg.message + " filtering on fields: " + filters);

                    for (var fieldNr = 0; fieldNr < fields.length; fieldNr++) {
                        var field = fields[fieldNr];


                        if (rec[field] !== undefined) {
                            //  console.log("Found field " + filter+" i = "+i.toString());

                            var val = rec[field].value;
                            var scale = rec[field].scale;
                            var offset = rec[field].offset;

                            //// Convert timestamps to local time
                            var timestamp;
                             if (rec.timestamp !== undefined)
                                timestamp = rec.timestamp.value;

                            //var start_time;
                            //if (rec.start_time !== undefined)
                            //    start_time = rec.start_time.value;

                            // Thought : skip value conversions here -> just pass through raw data and let higher level intepret...
                            //if (applyNormalDatetime) {
                            //    if (timestamp !== undefined) {
                            //        //var garminDateTimestamp = new GarminDateTime(timestamp);
                            //        //timestamp = garminDateTimestamp.convertTimestampToLocalTime(timezoneOffset);
                            //        timestamp = timestamp * 1000;
                            //    }
                            //    if (start_time !== undefined) {
                            //        //var garminDateTimestamp = new GarminDateTime(start_time);
                            //        //start_time = garminDateTimestamp.convertTimestampToLocalTime(timezoneOffset);
                            //        timestamp = timestamp * 1000;
                            //    }
                            //}

                            // If requested do some value conversions
                            //if (applyScaleOffset) {
                                if (scale !== undefined)
                                    val = val / scale;

                                if (offset !== undefined)
                                    val = val - offset;
                            //}

                            if (data[rec.message][field] === undefined)
                                data[rec.message][field] = [];

                            //if (query[queryNr].skiptimestamps)
                                data[rec.message][field].push(val);
                            //else
                            //    data[rec.message][field].push([util.convertTimestampToUTC(timestamp)+timeOffset, val]);
                        }
                    }
                }
            }
        }
    }

    this.index = prevIndex;

    //this.littleEndian = firstRecord.content.littleEndian; // The encoding used for records

    // Unclear if last 2 bytes of FIT file is big/little endian, but based on FIT header CRC is stored in little endian, so
    // it should be quite safe to assume the last two bytes is stored in little endian format
    //var CRC = this.getFITCRC(aFITBuffer.slice(-2), true);

    var CRC = dvFITBuffer.getUint16(aFITBuffer.byteLength - 2, true); // Force little endian
    //console.log("Stored 2-byte is CRC in file is : " + CRC.toString());

    // Not debugged yet...var verifyCRC = fitCRC(dvFITBuffer, 0, this.headerSize + this.dataSize, 0);


    //return JSON.stringify(data);
    
    return data;
}

FitFileManager.prototype.getGlobalMessageTypeName = function (globalMessageType) {
    // From profile.xls file in FIT SDK v 5.10

    var mesg_num = {
        0: "file_id",
        1: "capabilities",
        2: "device_settings",
        3: "user_profile",
        4: "hrm_profile",
        5: "sdm_profile",
        6: "bike_profile",
        7: "zones_target",
        8: "hr_zone",
        9: "power_zone",
        10: "met_zone",
        12: "sport",
        15: "goal",
        18: "session",
        19: "lap",
        20: "record",
        21: "event",
        23: "device_info",
        26: "workout",
        27: "workout_step",
        28: "schedule",
        30: "weight_scale",
        31: "course",
        32: "course_point",
        33: "totals",
        34: "activity",
        35: "software",
        37: "file_capabilities",
        38: "mesg_capabilities",
        39: "field_capabilities",
        49: "file_creator",
        51: "blood_pressure",
        53: "speed_zone",
        55: "monitoring",
        78: "hrv",
        101: "length",
        103: "monitoring_info",
        105: "pad",
        131: "cadence_zone",
        0xFF00: "mfg_range_min",
        0xFFEE: "mfg_range_max",

        // From https://forums.garmin.com/showthread.php?31347-Garmin-fit-global-message-numbers

        22: "source",
        104: "battery"
    }

    return mesg_num[globalMessageType];
}



FitFileManager.prototype.messageFactory = function (globalMessageType) {

    var name = this.getGlobalMessageTypeName(globalMessageType);
    var fitMsg = FITMessage();
    var message = { properties : undefined };

    switch (name) {
        case "file_creator":
            message.properties = fitMsg.fileCreator();
            break;
        case "file_id":
            message.properties = fitMsg.fileId();
            break;
        case "activity":
            message.properties = fitMsg.activity();
            break;
        case "record":
            message.properties = fitMsg.record();
            break;
        case "session":
            message.properties = fitMsg.session();
            break;
        case "lap":
            message.properties = fitMsg.lap();
            break;
        case "hrv":
            message.properties = fitMsg.hrv();
            break;
        
        
    }
    
    
    return message.properties;
    


}

FitFileManager.prototype.getDataRecordContent = function (rec) {

    var localMsgType = rec.header.localMessageType.toString();
    var definitionMsg = this["localMsgDefinition" + localMsgType];
    var globalMsgType = definitionMsg.content.globalMsgNr;

    var fieldNrs = definitionMsg.content.fieldNumbers;

    var msg = { "message": this.getGlobalMessageTypeName(globalMsgType) };
    msg.globalMessageType = globalMsgType;

    var logger = "";

    var globalMsg = this.messageFactory(globalMsgType);
    if (globalMsg === undefined)
        var t = 1;
        //console.error("Global Message Type " + globalMsgType.toString() + " number unsupported");
    else {

        for (var i = 0; i < fieldNrs; i++) {
            var field = "field" + i.toString();
            var fieldDefNr = rec.content[field].fieldDefinitionNumber;



            // Skip fields with invalid value
            if (!rec.content[field].invalid) {

                if (globalMsg[fieldDefNr] !== undefined && globalMsg[fieldDefNr] !== null)
                   // console.error("Cannot read property of fieldDefNr " + fieldDefNr.toString() + " on global message type " + globalMsgType.toString());
                 {
                    var prop = globalMsg[fieldDefNr].property;

                    var unit = globalMsg[fieldDefNr].unit;
                    var scale = globalMsg[fieldDefNr].scale;
                    var offset = globalMsg[fieldDefNr].offset;

                    // Duplication of code, maybe later do some value conversions here for specific messages
                    switch (globalMsgType) {
                        // file_id
                        case 0: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;
                            // session
                        case 18: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                            // lap
                        case 19: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;
                            // record
                        case 20: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                            // activity
                        case 34: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                            //  file_creator
                        case 49: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                            // hrv
                        case 78: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                        default: //console.error("Not implemented message for global type nr., check messageFactory " + globalMsgType.toString());
                            break;
                    }
                }
            }


            logger += fieldDefNr.toString() + ":" + rec.content[field].value.toString();
            if (rec.content[field].invalid)
                logger += "(I) ";
            else
                logger += " ";
        }

        // Hrv and Records are the most prominent data, so skip these for now too not fill the console.log
        //if (globalMsgType != 20 && globalMsgType != 78)
          //  console.log("Local msg. type = " + localMsgType.toString() + " linked to global msg. type = " + globalMsgType.toString() + ":" + this.getGlobalMessageTypeName(globalMsgType) + " field values = " + logger);
    }

    return msg;

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

    var headerInfo = {
        headerSize : dviewFitHeader.getUint8(0),
    protocolVersion : dviewFitHeader.getUint8(1),       // FIT SDK v5.1 - fit.h - 4-bit MSB = major - 4-bit LSB = minor
    profileVersion : dviewFitHeader.getUint16(2, true),  // FIT SDK v5.1: - fit h. -  major*100+minor
     dataSize : dviewFitHeader.getUint32(4, true)
    };


    headerInfo.protocolVersionMajor = headerInfo.protocolVersion >> 4;
    headerInfo.protocolVersionMinor = headerInfo.protocolVersion & 0x0F;

    headerInfo.profileVersionMajor = Math.floor(headerInfo.profileVersion / 100);
    headerInfo.profileVersionMinor = headerInfo.profileVersion - (headerInfo.profileVersionMajor * 100);

    var estimatedFitFileSize = headerInfo.headerSize + headerInfo.dataSize + 2;  // 2 for last CRC

    //if (estimatedFitFileSize != fitFileSystemSize)
        
    //      console.warn("Header reports FIT file size " + estimatedFitFileSize.toString() + " bytes, but file system reports: " + fitFileSystemSize.toString() + " bytes.");

    // 4 januar : Testet med IE 10, støtter ikke slice metoden...

    // this.dataType = ab2str(bufFitHeader.slice(8, 12)); // Should be .FIT ASCII codes

    headerInfo.dataType = "";
    for (var indx = 8; indx < 12; indx++)
        headerInfo.dataType += String.fromCharCode(dviewFitHeader.getUint8(indx));

    this.index = 12;

    // Optional header info

    if (headerInfo.headerSize >= MAXFITHEADERLENGTH) {
        headerInfo.headerCRC = dviewFitHeader.getUint16(12, true);
        this.index += 2;
        //if (this.headerCRC === 0)
        //    console.info("Header CRC was not stored in file");

    }

    return headerInfo;

}



FitFileManager.prototype.getRecord = function (dviewFit) {

    // From table 4-6 p. 22 in D00001275 Flexible & Interoperable Data Transfer (FIT) Protocol Rev 1.3

    var fitBaseTypesInvalidValues = {};
    fitBaseTypesInvalidValues[0x00] = {
        "name": "enum",
        "invalidValue": 0xFF
    };
    fitBaseTypesInvalidValues[0x01] = {
        "name": "sint8",
        "invalidValue": 0x7F
    };
    fitBaseTypesInvalidValues[0x02] = {
        "name": "uint8",
        "invalidValue": 0xFF
    };
    fitBaseTypesInvalidValues[0x83] = {
        "name": "sint16",
        "invalidValue": 0x7FFF
    };
    fitBaseTypesInvalidValues[0x84] = {
        "name": "uint16",
        "invalidValue": 0xFFFF
    };
    fitBaseTypesInvalidValues[0x85] = {
        "name": "sint32",
        "invalidValue": 0x7FFFFFFF
    };
    fitBaseTypesInvalidValues[0x86] = {
        "name": "uint32",
        "invalidValue": 0xFFFFFFFF
    };
    fitBaseTypesInvalidValues[0x07] = {
        "name": "string",
        "invalidValue": 0x00
    };
    fitBaseTypesInvalidValues[0x88] = {
        "name": "float32",
        "invalidValue": 0xFFFFFFFF
    };
    fitBaseTypesInvalidValues[0x89] = {
        "name": "float64",
        "invalidValue": 0xFFFFFFFFFFFFFFFF
    };

    fitBaseTypesInvalidValues[0x0A] = {
        "name": "uint8z",
        "invalidValue": 0x00
    };
    fitBaseTypesInvalidValues[0x8B] = {
        "name": "uint16z",
        "invalidValue": 0x0000
    };
    fitBaseTypesInvalidValues[0x8C] = {
        "name": "uint32z",
        "invalidValue": 0x00000000
    };
    fitBaseTypesInvalidValues[0x0D] = {
        "name": "byte",
        "invalidValue": 0xFF
    };



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

    recHeader.byte = dviewFit.getUint8(this.index++);
    recHeader.headerType = (recHeader.byte & HEADERTYPE_FLAG) >> 7; // MSB 7 0 = normal header, 1 = compressed timestampheader

    switch (recHeader.headerType) {
        case 0: // Normal header
            recHeader.messageType = (recHeader.byte & NORMAL_MESSAGE_TYPE_FLAG) >> 6; // bit 6 - 1 = definition, 0 = data msg.
            // bit 5 = 0 reserved
            // bit 4 = 0 reserved
            recHeader.localMessageType = recHeader.byte & NORMAL_LOCAL_MESSAGE_TYPE_FLAGS; // bit 0-3

            break;
        case 1: // Compressed timestamp header - only for data records
            recHeader.localMessageType = (recHeader.byte & COMPRESSED_TIMESTAMP_LOCAL_MESSAGE_TYPE_FLAGS) >> 5;
            recHeader.timeOffset = (recHeader.byte & TIMEOFFSET_FLAGS); // bit 0-4 - in seconds since a fixed reference start time (max 32 secs)
            break;

    }

    record.header = recHeader;
    // console.log("Header type: " + recHeader["headerType"] + " Local message type: " + recHeader["localMessageType"].toString());

    // VARIALE CONTENT, EITHER DATA OR DEFINITION

    switch (recHeader.messageType) {
        case DEFINITION_MSG:
            //  5 byte FIXED content header
            recContent.reserved = dviewFit.getUint8(this.index++); // Reserved = 0
            recContent.littleEndian = dviewFit.getUint8(this.index++) === 0; // 0 = little endian 1 = big endian (javascript dataview defaults to big endian!)
            recContent.globalMsgNr = dviewFit.getUint16(this.index, recContent.littleEndian); // what kind of data message
            this.index = this.index + 2;
            recContent.fieldNumbers = dviewFit.getUint8(this.index++); // Number of fields in data message

            // VARIABLE content - field definitions as properties

            for (var fieldNr = 0; fieldNr < recContent.fieldNumbers; fieldNr++)
                recContent["field" + fieldNr.toString()] = {
                    "fieldDefinitionNumber": dviewFit.getUint8(this.index++),
                    "size": dviewFit.getUint8(this.index++),
                    "baseType": dviewFit.getUint8(this.index++)
                }

            //       console.log("Definition message, global message nr. = ", recContent["globalMsgNr"].toString() + " contains " + recContent["fieldNumbers"].toString() + " fields");

            break;

        case DATA_MSG: // Lookup in msg. definition in properties -> read fields
            var localMsgDefinition = this["localMsgDefinition" + recHeader.localMessageType.toString()];
            if (localMsgDefinition === undefined || localMsgDefinition === null)
                throw new Error("Could not find message definition of data message");

            // Loop through all field definitions and read corresponding fields in data message

            var littleEndian = localMsgDefinition.content.littleEndian;

            // var logging = "";
            for (var fieldNr = 0; fieldNr < localMsgDefinition.content.fieldNumbers; fieldNr++) {
                var currentField = "field" + fieldNr.toString();
                var bType = localMsgDefinition.content[currentField].baseType;
                var bSize = localMsgDefinition.content[currentField].size;

                if (fitBaseTypesInvalidValues[bType] === undefined || fitBaseTypesInvalidValues[bType] === null)
                    console.log("Base type not found for base type" + bType);
                //  logging += fitBaseTypesInvalidValues[bType].name+" ";
                // Just skip reading values at the moment...
                // this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;

                recContent[currentField] = { fieldDefinitionNumber: localMsgDefinition.content[currentField].fieldDefinitionNumber };

                switch (bType) {
                    case 0x00:
                    case 0x0A:
                        recContent[currentField].value = dviewFit.getUint8(this.index); break;
                        //case 0x0A: recContent["field" + i.toString()] = { "value": dviewFit.getUint8(this.index++) }; break;
                    case 0x01: recContent[currentField].value = dviewFit.getInt8(this.index); break;
                    case 0x02: recContent[currentField].value = dviewFit.getUint8(this.index); break;
                    case 0x83: recContent[currentField].value = dviewFit.getInt16(this.index, littleEndian); break;
                    case 0x84:
                    case 0x8B:
                        recContent[currentField].value = dviewFit.getUint16(this.index, littleEndian); break;
                        // recContent["field" + i.toString()] = { "value": dviewFit.getUint16(this.index, littleEndian) }; this.index += 2; break;
                    case 0x85: recContent[currentField].value = dviewFit.getInt32(this.index, littleEndian); break;
                    case 0x86:
                    case 0x8C:
                        recContent[currentField].value = dviewFit.getUint32(this.index, littleEndian); break;
                        //recContent["field" + i.toString()] = { "value": dviewFit.getUint32(this.index, littleEndian) }; this.index += 4; break;
                    case 0x07: //console.error("String not implemented yet!");
                        var stringStartIndex = this.index;
                        var str = "";
                        for (var charNr = 0; charNr < bSize; charNr++) {
                            var char = dviewFit.getUint8(stringStartIndex++);
                            if (char === 0) // Null terminated string
                                break;
                            str += String.fromCharCode(char);
                        }

                        console.log("Got a null terminated string " + str);
                        recContent[currentField] = { "value": str };
                        break;

                        //this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
                    
                    case 0x88: recContent[currentField].value = dviewFit.getFloat32(this.index, littleEndian); break;
                    case 0x89: recContent[currentField].value = dviewFit.getFloat64(this.index, littleEndian); break;
                    case 0x0D: //console.error("Array of bytes not implemented yet!");
                        var bytesStartIndex = this.index;
                        var bytes = [];
                        for (var byteNr = 0; byteNr < bSize; byteNr++)
                            bytes.push(dviewFit.getUint8(bytesStartIndex++));
                        console.log("Got an byte array with " + bSize.toString() + " bytes");
                        recContent[currentField] = { "value": bytes }; 
                        //recContent["field" + i.toString()] = { "value" : dviewFit.getUint8(this.index++) }; break; // ARRAY OF BYTES FIX
                        break;
                    default: //throw new Error("Base type " + bType.toString() + " not found in lookup switch"); break;
                        console.error("Base type " + bType.toString() + " not found in lookup switch");
                        break;
                }

                // Did we get an invalid value?

                if (fitBaseTypesInvalidValues[bType].invalidValue === recContent[currentField].value)
                    recContent[currentField].invalid = true;
                else
                    recContent[currentField].invalid = false;

                // Advance to next field value position
                this.index = this.index + bSize;
            }

            //console.log(logging);

            break;
    }

    record.content = recContent;

    return record;
}



