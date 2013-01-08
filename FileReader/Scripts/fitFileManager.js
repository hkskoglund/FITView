var fitFileManager;

var workerThreadContext = self;

// self = dedicatedWorkerContext
// console = undefined in worker -> comment out console.* msg

self.addEventListener('message', function (e) {
    // We get an MessageEvent of type message = e
    var data = e.data;

    if (data.request == undefined) {
        self.postMessage("Unrecognized command!");
        return;
    }

    switch (data.request) {

        case 'loadFitFile':   fitFileManager = new FitFileManager(data.fitfile,data.timeCalibration);
            break;
        default: self.postMessage('Unrecongized command' + data.request); break;
    }

  
},false);


function FitFileManager(fitFile,timeCalibration) {
    this.fitFile = fitFile; // Reference to FIT file in browser - FILE API
    this.index = 0; // Pointer to next unread byte in FIT file
    this.records = [] // Holds every global message nr. contained in FIT file
    this.fileBuffer = {};

    this.timeCalibration = timeCalibration // Offset from Garmin time 

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
    }

    this.fitFileReader = new FileReaderSync();
   

   
    try {
        this.fileBuffer = this.fitFileReader.readAsArrayBuffer(this.fitFile);
        
    } catch (e) {
        //console.error('Could not initialize fit file reader with bytes, message:', e.message);
    }

    this.setupFITHeader(this.fileBuffer, this.fitFile.size);

    // Start reading records from file
    var rawData = {};


    var rawDataJSON = this.getDataRecords("record", "heart_rate altitude cadence speed", true, this.timeCalibration, true);
    //FITUI.fitFileManager.parseRecords(rawData, "lap", "total_ascent total_descent avg_heart_rate max_heart_rate", true, true,false);
    //FITUI.fitFileManager.parseRecords(rawData, "hrv", "hrv", true, true, true);
    

    self.postMessage({ response: "rawData", data: rawDataJSON });
}

// query = { [ "record","f1 f2 f3"],["lap","f1 f2 f3"] }

FitFileManager.prototype.getDataRecords = function (message, filters, applyScaleOffset, applyNormalDatetime, timeCalibration, skipTimeStamp) {
    var aFITBuffer = this.fileBuffer;
    var dvFITBuffer = new DataView(aFITBuffer);

    var prevIndex = this.index; // If parseRecords are called again it will start just after header again

    // Date object not available for webworker
   // var d = new Date();
   // var timezoneOffset = d.getTimezoneOffset();

    var data = {};


    while (this.index < this.headerSize + this.dataSize) {
        var rec = this.getRecord(dvFITBuffer, this.index);

        // If we got an definition message, store it as a property 
        if (rec.header["messageType"] == 1)
            this["localMsgDefinition" + rec.header["localMessageType"].toString()] = rec;
        else {
            var msg = this.getDataRecordContent(rec); // Data record RAW from device - no value conversion (besides scale and offset adjustment)

            this.records.push(msg.globalMessageType);


            if (msg.message === message) {  // only look for specfic message

                var filterArr = filters.split(" "); // Filters format f1 f2 f3 ... fn
                //console.log("Request for raw data filtering on message : " + msg.message + " filtering on fields: " + filters);

                for (var i = 0; i < filterArr.length; i++) {
                    var filter = filterArr[i];


                    if (msg[filter] != undefined) {
                        //  console.log("Found field " + filter+" i = "+i.toString());

                        var val = msg[filter].value;
                        var scale = msg[filter].scale;
                        var offset = msg[filter].offset;

                        // Convert timestamps to local time
                        var timestamp;
                        if (msg.timestamp != undefined)
                            timestamp = msg.timestamp.value;

                        var start_time;
                        if (msg.start_time != undefined)
                            start_time = msg.start_time.value;


                        if (applyNormalDatetime) {
                            if (timestamp != undefined) {
                                //var garminDateTimestamp = new GarminDateTime(timestamp);
                                //timestamp = garminDateTimestamp.convertTimestampToLocalTime(timezoneOffset);
                                timestamp = timestamp * 1000 + timeCalibration;
                            }
                            if (start_time != undefined) {
                                //var garminDateTimestamp = new GarminDateTime(start_time);
                                //start_time = garminDateTimestamp.convertTimestampToLocalTime(timezoneOffset);
                                timestamp = timestamp * 1000 + timeCalibration;
                            }
                        }

                        // If requested do some value conversions
                        if (applyScaleOffset) {
                            if (scale != undefined)
                                val = val / scale;

                            if (offset != undefined)
                                val = val - offset;
                        }

                        if (data[filter] == undefined)
                            data[filter] = [];

                        if (skipTimeStamp)
                            data[filter].push(val);
                        else
                            data[filter].push([timestamp, val]);
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


    return JSON.stringify(data);
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
            0: { "property": "software_version" },
            1: { "property": "hardware_version" }
        }

    if (name === "file_id")
        return {
            0: { "property": "type" },
            1: { "property": "manufacturer" },
            2: { "property": "product" },
            3: { "property": "serial_number" },
            4: { "property": "time_created" },
            5: { "property": "number" }
        }

    // ACTIVITY FILE MESSAGES

    if (name === "activity") {
        return {
            253: { "property": "timestamp", "unit": "s" },
            0: { "property": "total_timer_time", "scale": 1000, "unit": "s" }, // Excluding pauses
            1: { "property": "num_sessions" },
            2: { "property": "type" },
            3: { "property": "event" },
            4: { "property": "event_type" },
            5: { "property": "local_timestamp" },
            6: { "property": "event_group" }
        }
    }

    if (name === "record")

        return {





            253: { "property": "timestamp", "unit": "s" },
            0: { "property": "position_lat", "unit": "semicirles" },
            1: { "property": "position_long", "unit": "semicirles" },
            2: { "property": "altitude", "scale": 5, "offset": 500, "unit": "m" },
            3: { "property": "heart_rate", "unit": "bpm" },
            4: { "property": "cadence", "unit": "rpm" },
            5: { "property": "distance", "scale": 100, "unit": "m" },
            6: { "property": "speed", "scale": 1000, "unit": "m/s" },
            7: { "property": "power", "unit": "watts" },
            8: { "property": "compressed_speed_distance" }, // TO DO FIX
            9: { "property": "grade", "scale": 100, "unit": "%" },
            10: { "property": "resistance" },
            11: { "property": "time_from_course", "scale": 1000, "unit": "s" },
            12: { "property": "cycle_length", "scale": 100, "unit": "m" },
            13: { "property": "temperature", "unit": "C" },
            17: { "property": "speed_1s", "unit": "m/s" },
            18: { "property": "cycles", "unit": "cycles" }, //TO DO FIX
            19: { "property": "total_cycles", "unit": "cycles" },
            28: { "property": "compressed_accumulated_power", "unit": "watts" }, // TO DO FIX
            29: { "property": "accumulated_power", "unit": "watts" },
            30: { "property": "left_right_balance" },
            31: { "property": "gps_accuracy", "unit": "m" },
            32: { "property": "vertical_speed", "scale": 1000, "unit": "m/s" },
            33: { "property": "calories", "unit": "kcal" }
        }

    if (name === "session")

        return {
            254: { "property": "message_index" },
            253: { "property": "timestamp", "unit": "s" },   // Session end time
            0: { "property": "event" },
            1: { "property": "event_type" },
            2: { "property": "start_time" },
            3: { "property": "start_position_lat", "unit": "semicirles" },
            4: { "property": "start_position_long", "unit": "semicirles" },
            5: { "property": "sport" },
            6: { "property": "sub_sport" },
            7: { "property": "total_elapsed_time", "unit": "s", "scale": 1000 }, // Time (includes pauses)
            8: { "property": "total_timer_time", "unit": "s", "scale": 1000 }, // Timer Time (excludes pauses)
            9: { "property": "total_distance", "unit": "m", "scale": 100 },
            10: { "property": "total_cycles_strides" },
            11: { "property": "total_calories", "unit": "kcal" },
            // Where is 12? hmmm...
            13: { "property": "total_fat_calories", "unit": "kcal" }, // IF New Leaf
            14: { "property": "avg_speed", "unit": "m/s", "scale": 1000 },
            15: { "property": "max_speed", "unit": "m/s", "scale": 1000 },
            16: { "property": "avg_heart_rate", "unit": "bpm" },
            17: { "property": "max_heart_rate", "unit": "bpm" },
            18: { "property": "avg_cadence", "unit": "rpm" },
            19: { "property": "max_cadence", "unit": "rpm" },
            20: { "property": "avg_power", "unit": "watts" },
            21: { "property": "max_power", "unit": "watts" },
            22: { "property": "total_ascent", "unit": "m" },
            23: { "property": "total_descent", "unit": "m" },
            24: { "property": "total_training_effect", "scale": 10 },
            25: { "property": "first_lap_index" },
            26: { "property": "num_laps" },
            27: { "property": "event_group" },

            28: { "property": "trigger" },
            29: { "property": "nec_lat", "unit": "semicirles" },
            30: { "property": "nec_long", "unit": "semicirles" },
            31: { "property": "swc_lat", "unit": "semicirles" },
            32: { "property": "swc_long", "unit": "semicirles" },
            34: { "property": "normalized_power", "unit": "watts" },
            35: { "property": "training_stress_score", "unit": "tss", scale: 10 },
            36: { "property": "intensity_factor", "unit": "if", scale: 1000 },
            37: { "property": "left_right_balance", "unit": "watts" },

            41: { "property": "avg_stroke_count", "scale": 10, "unit": "strokes/lap" },
            42: { "property": "avg_stroke_distance", "scale": 100, "unit": "m" },
            43: { "property": "swim_stroke" },
            44: { "property": "pool_length", "scale": 100, "unit": "m" },
            46: { "property": "pool_length_unit" },
            47: { "property": "num_active_lengths", "unit": "lengths" }, // # active lengths of swim pool
            48: { "property": "total_work", "unit": "J" },

            49: { "property": "avg_altitude", "scale": 5, "offset": 500, "unit": "m" },
            50: { "property": "max_altitude", "scale": 5, "offset": 500, "unit": "m" },
            51: { "property": "gps_accuracy", "unit": "m" },
            52: { "property": "avg_grade", "unit": "%", "scale": 100 },
            53: { "property": "avg_pos_grade", "unit": "%", "scale": 100 },
            54: { "property": "avg_neg_grade", "unit": "%", "scale": 100 },
            55: { "property": "max_pos_grade", "unit": "%", "scale": 100 },
            56: { "property": "max_neg_grade", "unit": "%", "scale": 100 },
            57: { "property": "avg_temperature", "unit": "C" },
            58: { "property": "max_temperature", "unit": "C" },
            59: { "property": "total_moving_time", "scale": 1000, "unit": "s" },
            60: { "property": "avg_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
            61: { "property": "avg_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
            62: { "property": "max_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
            63: { "property": "max_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
            64: { "property": "min_heart_rate", "unit": "bpm" },
            65: { "property": "time_in_hr_zone", "scale": 1000, "unit": "s" }, // [N] array of N, may get some trouble here...
            66: { "property": "time_in_speed_zone", "scale": 1000, "unit": "s" }, // [N]
            67: { "property": "time_in_cadence_zone", "scale": 1000, "unit": "s" }, // [N]
            68: { "property": "time_in_power_zone", "scale": 1000, "unit": "s" },  // [N]
            69: { "property": "avg_lap_time", "scale": 1000, "unit": "s" },
            70: { "property": "best_lap_index" },
            71: { "property": "min_altitude", "scale": 5, "offset": 500, "unit": "m" },

        }

    if (name === "lap")

        return {
            254: { "property": "message_index" },
            253: { "property": "timestamp", "unit": "s" },   // Lap end time
            0: { "property": "event" },
            1: { "property": "event_type" },
            2: { "property": "start_time" },
            3: { "property": "start_position_lat", "unit": "semicirles" },
            4: { "property": "start_position_long", "unit": "semicirles" },
            5: { "property": "end_position_lat", "unit": "semicirles" },
            6: { "property": "end_position_long", "unit": "semicirles" },
            7: { "property": "total_elapsed_time", "unit": "s", "scale": 1000 }, // Time (includes pauses)
            8: { "property": "total_timer_time", "unit": "s", "scale": 1000 }, // Timer Time (excludes pauses)
            9: { "property": "total_distance", "unit": "m", "scale": 100 },
            10: { "property": "total_cycles_strides" },
            11: { "property": "total_calories", "unit": "kcal" },
            12: { "property": "total_fat_calories", "unit": "kcal" }, // IF New Leaf
            13: { "property": "avg_speed", "unit": "m/s", "scale": 1000 },
            14: { "property": "max_speed", "unit": "m/s", "scale": 1000 },
            15: { "property": "avg_heart_rate", "unit": "bpm" },
            16: { "property": "max_heart_rate", "unit": "bpm" },
            17: { "property": "avg_cadence", "unit": "rpm" },
            18: { "property": "max_cadence", "unit": "rpm" },
            19: { "property": "avg_power", "unit": "watts" },
            20: { "property": "max_power", "unit": "watts" },
            21: { "property": "total_ascent", "unit": "m" },
            22: { "property": "total_descent", "unit": "m" },
            23: { "property": "intensity" },
            24: { "property": "lap_trigger" },
            25: { "property": "sport" },
            26: { "property": "event_group" },
            32: { "property": "num_lengths", "unit": "lengths" }, // # lengths in swim pool
            33: { "property": "normalized_power", "unit": "watts" },
            34: { "property": "left_right_balance", "unit": "watts" },
            35: { "property": "first_length_index" },
            37: { "property": "avg_stroke_distance", "scale": 100, "unit": "m" },
            38: { "property": "swim_stroke" },
            39: { "property": "sub_sport" },
            40: { "property": "num_active_lengths", "unit": "lengths" },
            41: { "property": "total_work", "unit": "J" },
            42: { "property": "avg_altitude", "scale": 5, "offset": 500, "unit": "m" },
            43: { "property": "max_altitude", "scale": 5, "offset": 500, "unit": "m" },
            44: { "property": "gps_accuracy", "unit": "m" },
            45: { "property": "avg_grade", "unit": "%", "scale": 100 },
            46: { "property": "avg_pos_grade", "unit": "%", "scale": 100 },
            47: { "property": "avg_neg_grade", "unit": "%", "scale": 100 },
            48: { "property": "max_pos_grade", "unit": "%", "scale": 100 },
            49: { "property": "max_neg_grade", "unit": "%", "scale": 100 },
            50: { "property": "avg_temperature", "unit": "C" },
            51: { "property": "max_temperature", "unit": "C" },
            52: { "property": "total_moving_time", "scale": 1000, "unit": "s" },
            53: { "property": "avg_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
            54: { "property": "avg_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
            55: { "property": "max_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
            56: { "property": "max_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
            57: { "property": "time_in_hr_zone", "scale": 1000, "unit": "s" },
            58: { "property": "time_in_speed_zone", "scale": 1000, "unit": "s" },
            59: { "property": "time_in_cadence_zone", "scale": 1000, "unit": "s" },
            60: { "property": "time_in_power_zone", "scale": 1000, "unit": "s" },
            61: { "property": "repetition_num", "scale": 1000, "unit": "s" },
            62: { "property": "min_altitude", "scale": 5, "offset": 500, "unit": "m" },
            63: { "property": "min_heart_rate", "unit": "m" },
            71: { "property": "wkt_step_index", "unit": "bpm" },
        }

    if (name === "hrv") {
        return {
            0: { "property": "hrv", "unit": "s", "scale": 1000 }
        }
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
        var t = 1;
        //console.error("Global Message Type " + globalMsgType.toString() + " number unsupported");
    else {

        for (var i = 0; i < fieldNrs; i++) {
            var field = "field" + i.toString();
            var fieldDefNr = rec.content[field].fieldDefinitionNumber;



            // Skip fields with invalid value
            if (!rec.content[field].invalid) {

                if (globalMsg[fieldDefNr] != undefined && globalMsg[fieldDefNr] != null)
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

FitFileManager.prototype.setupFITHeader = function (bufFitHeader, fitFileSystemSize) {

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

    //if (estimatedFitFileSize != fitFileSystemSize)
        
    //      console.warn("Header reports FIT file size " + estimatedFitFileSize.toString() + " bytes, but file system reports: " + fitFileSystemSize.toString() + " bytes.");

    // 4 januar : Testet med IE 10, støtter ikke slice metoden...

    // this.dataType = ab2str(bufFitHeader.slice(8, 12)); // Should be .FIT ASCII codes

    this.dataType = "";
    for (var indx = 8; indx < 12; indx++)
        this.dataType += String.fromCharCode(dviewFitHeader.getUint8(indx));

    this.index = 12;

    // Optional header info

    if (this.headerSize >= MAXFITHEADERLENGTH) {
        this.headerCRC = dviewFitHeader.getUint16(12, true);
        this.index += 2;
        //if (this.headerCRC === 0)
        //    console.info("Header CRC was not stored in file");

    }



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
                var currentField = "field" + i.toString();
                var bType = localMsgDefinition.content[currentField].baseType;
                var bSize = localMsgDefinition.content[currentField].size;

                if (fitBaseTypesInvalidValues[bType] == undefined || fitBaseTypesInvalidValues[bType] == null)
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
                        for (var j = 0; j < bSize; j++) {
                            var char = dviewFit.getUint8(stringStartIndex++);
                            if (char == 0) // Null terminated string
                                break;
                            str += String.fromCharCode(char);
                        }

                        console.log("Got a null terminated string " + str);
                        recContent[currentField] = { "value": str }; break;

                        //this.index = this.index + localMsgDefinition.content["field" + i.toString()].size;
                        break;
                    case 0x88: recContent[currentField].value = dviewFit.getFloat32(this.index, littleEndian); break;
                    case 0x89: recContent[currentField].value = dviewFit.getFloat64(this.index, littleEndian); break;
                    case 0x0D: //console.error("Array of bytes not implemented yet!");
                        var bytesStartIndex = this.index;
                        var bytes = [];
                        for (var j = 0; j < bSize; j++)
                            bytes.push(dviewFit.getUint8(bytesStartIndex++));
                        console.log("Got an byte array with " + bSize.toString() + " bytes");
                        recContent[currentField] = { "value": bytes }; break;
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

    record["content"] = recContent;

    return record;
}


