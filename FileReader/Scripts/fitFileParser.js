var outConsole, inpFITFile, btnParse, selectedFiles;
var fitFileManager;

$(document).ready(function () {
    // Setup DOM event handling

    outConsole = document.getElementById('outConsole');

    // Capturing = false -> bubbling event
    inpFITFile = document.getElementById('inpFITFile');
    inpFITFile.addEventListener('change', onFitFileSelected, false);

    fitFileManager = new FitFileManager();

     btnParse = document.getElementById('btnParse')
    btnParse.addEventListener('click', fitFileManager.onbtnParseClick, false);

     selectedFiles; // All File thats selected

});


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
            var rawData = {};
            self.parseRecords(rawData, "record", "heart_rate altitude cadence speed", true);

            // We get speed in m/s, want it in km/h
            if (rawData["speed"] != undefined)
                rawData["speed"].forEach(function (element, index, array) {
                    array[index] = element * 3.6;
                });

            var seriesSetup = [{ name: 'Heart rate', data: rawData["heart_rate"] },
                { name: 'Altitude', data: rawData["altitude"] },
            { name: 'Cadence', data: rawData["cadence"] },
            { name: 'Speed', data: rawData["speed"] }];

            // Charting

            chart1 = new Highcharts.Chart({
                chart: {
                    renderTo: 'testChart',
                    type: 'line'
                },
                title: {
                    text: ''
                },
                // xAxis: {
                //     categories: ['Apples', 'Bananas', 'Oranges']
                // },
                yAxis: {
                    title: {
                        text: 'bpm'
                    }
                },

                series : seriesSetup

            });

  
        } catch (err) {
            console.error('Trouble with FIT file header parsing, message:', err.message);
        }

    }
}

FitFileManager.prototype.parseRecords = function (data,message,filters,applyScaleOffset) {
    var aFITBuffer = this.fitReader.result;
    var dvFITBuffer = new DataView(aFITBuffer);

    var prevIndex = this.index;

    while (this.index < this.headerSize + this.dataSize) {
        var rec = this.getRecord(dvFITBuffer, this.index);

        // If we got an definition message, store it as a property 
        if (rec.header["messageType"] == 1)
            this["localMsgDefinition" + rec.header["localMessageType"].toString()] = rec;
        else {
            var msg = this.getDataRecordContent(rec); // Data record RAW from device - no value conversions...

            if (msg.message === message) {  // only look for specfic message
                var filterArr = filters.split(" "); // Filters format f1 f2 f3 ... fn
                for (var i = 0; i < filterArr.length; i++) {
                    var filter = filterArr[i];
                    if (msg[filter] != undefined) {
                        var val = msg[filter].value;
                        var scale = msg[filter].scale;
                        var offset = msg[filter].offset;

                        // If requested do some value conversions
                        if (applyScaleOffset) {
                            if (scale != undefined)
                                val = val / scale;

                            if (offset != undefined)
                                val = val - offset;
                        }

                        if (data[filter] == undefined)
                            data[filter] = [];

                        data[filter].push(val);
                    }
                }
            }
        }
    }

    this.index = prevIndex; 

    //this.littleEndian = firstRecord.content.littleEndian; // The encoding used for records

    // Unclear if last 2 bytes of FIT file is big/little endian, but based on FIT header CRC is stored in little endian, so
    // it should be quite safe to assume the last two bytes is stored in little endian format
    var CRC = this.getFITCRC(aFITBuffer.slice(-2), true);
    console.log("Stored 2-byte is CRC in file is : " + CRC.toString());

    // Not debugged yet...var verifyCRC = fitCRC(dvFITBuffer, 0, this.headerSize + this.dataSize, 0);

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

    
    if (name === "file_creator")
        return {
            0: {"property" : "software_version"},
            1: { "property": "hardware_version" }
        }

    if (name === "file_id")
       return {
           0: {"property" : "type"},
           1: {"property" : "manufacturer"},
           2: {"property" : "product"},
           3: {"property" : "serial_number"},
           4: {"property" : "time_created"},
           5: { "property": "number" }
       }

    if (name === "record")

        return {

            253: {"property" : "timestamp",  "unit": "s"  },
            0: {"property" : "position_lat","unit":"semicirles"},
            1: {"property" : "position_long", "unit":"semicirles"},
            2: {"property" : "altitude", "scale" : 5, "offset" : 500, "unit": "m"},
            3: {"property" : "heart_rate", "unit": "bpm"  },
            4: {"property" : "cadence", "unit": "rpm"  },
            5: {"property" : "distance", "scale" : 100, "unit" : "m"},
            6: { "property": "speed", "scale": 1000,"unit" : "m/s" },
            7: {"property" : "power", "unit" : "watts"},
            8: {"property" : "compressed_speed_distance"}, // TO DO FIX
            9: {"property" : "grade", "scale" : 100, "unit" : "%"},
            10: {"property" : "resistance"},
            11: {"property" : "time_from_course", "scale" : 1000, "unit" : "s"},
            12: {"property" : "cycle_length", "scale" : 100, "unit" : "m"},
            13: {"property" : "temperature", "unit" : "C"},
            17: {"property" : "speed_1s", "unit" : "m/s"},
            18: {"property" :  "cycles", "unit" : "cycles"}, //TO DO FIX
            19: {"property" : "total_cycles","unit" : "cycles"},
            28: {"property" : "compressed_accumulated_power", "unit" : "watts"}, // TO DO FIX
            29: {"property" : "accumulated_power", "unit" : "watts"},
            30: {"property" : "left_right_balance"},
            31: {"property" : "gps_accuracy", "unit" : "m"},
            32: {"property" : "vertical_speed", "scale" : 1000, "unit" : "m/s"},
            33: {"property" : "calories", "unit" : "kcal"}
        }
}

FitFileManager.prototype.getDataRecordContent = function (rec) {

    var localMsgType = rec.header["localMessageType"].toString();
    var definitionMsg = this["localMsgDefinition" + localMsgType];
    var globalMsgType = definitionMsg.content.globalMsgNr;

    var fieldNrs = definitionMsg.content.fieldNumbers;

    var msg = { "message": this.getGlobalMessageTypeName(globalMsgType) };
    msg.globalMessageType = globalMsgType;

    var logger = "";

    var globalMsg = this.messageFactory(globalMsgType);
    if (globalMsg === undefined)
        console.error("Global Message Type " + globalMsgType.toString() + " number unsupported");
    else {

        for (var i = 0; i < fieldNrs; i++) {
            var field = "field" + i.toString();
            var fieldDefNr = rec.content[field].fieldDefinitionNumber;



            // Skip fields with invalid value
            if (!rec.content[field].invalid) {

                var prop = globalMsg[fieldDefNr].property;
                var unit = globalMsg[fieldDefNr].unit;
                var scale = globalMsg[fieldDefNr].scale;
                var offset = globalMsg[fieldDefNr].offset;

                switch (globalMsgType) {
                    // file_id
                    case 0: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;
                        // record
                    case 20: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;
                        //  file_creator
                    case 49: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                    default: console.error("Not implemented message for global type nr. " + globalMsgType.toString());
                        break;
                }
            }


            logger += fieldDefNr.toString() + ":" + rec.content[field].value.toString();
            if (rec.content[field].invalid)
                logger += "(I) ";
            else
                logger += " ";
        }


        console.log("Local msg. type = " + localMsgType.toString() + " linked to global msg. type = " + globalMsgType.toString() + ":" + this.getGlobalMessageTypeName(globalMsgType) + " field values = " + logger);
    }

    return msg;

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
   // console.log("Header type: " + recHeader["headerType"] + " Local message type: " + recHeader["localMessageType"].toString());

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

     //       console.log("Definition message, global message nr. = ", recContent["globalMsgNr"].toString() + " contains " + recContent["fieldNumbers"].toString() + " fields");

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

                var currentField = "field" + i.toString();
                recContent[currentField] = {};
                recContent[currentField]["fieldDefinitionNumber"] = localMsgDefinition.content["field" + i.toString()].fieldDefinitionNumber;

              

                switch (bType) {
                    case 0x00:
                    case 0x0A:
                        recContent[currentField].value = dviewFit.getUint8(this.index) ; break;
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
                    case 0x07: console.error("String not implemented yet!");
                        //recContent["field" + i.toString()] = { "value" : dviewFit.getUint8(this.index++) }; break; // FIX IT LATER!!! Null terminated string? of 1 byte
                        //this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
                        break;
                    case 0x88: recContent[currentField].value =  dviewFit.getFloat32(this.index, littleEndian) ; break;
                    case 0x89: recContent[currentField].value =  dviewFit.getFloat64(this.index, littleEndian); break;
                    case 0x0D: console.error("Array of bytes not implemented yet!");
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
                this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
            }

            //console.log(logging);

            break;
    }

    record["content"] = recContent;

    return record;
}
