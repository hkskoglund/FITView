//use strict
// Will load "Script/FITMessage.js probably since worker is loaded from /Scripts directory
importScripts('FITActivityFile.js', 'FITUtility.js');  

(

 function () {
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

            case 'importFitFile':
                var options = {
                    fitfile: data.fitfile
                    //,query: data.query,

                };

                fitFileManager = FitFileImport(options);
                fitFileManager.readFitFile();
                

                break;
            default:
                self.postMessage('Unrecognized command' + data.request);
                break;
        }


    }, false);


    function FitFileImport(options) {
        var exposeFunc = {};


       // var fitFileManager = this;

        var fitFile = options.fitfile; // Reference to FIT file in browser - FILE API
        var index = 0; // Pointer to next unread byte in FIT file
        var records = []; // Holds every global message nr. contained in FIT file
        var fileBuffer = {};

        var fitFileReader;
        var headerInfo;

        var localMsgDef = {};

        //this.query = options.query;


        //this.event_type = {
        //    start: 0,
        //    stop: 1,
        //    consecutive_depreciated: 2,
        //    marker: 3,
        //    stop_all: 4,
        //    begin_depreciated: 5,
        //    end_depreciated: 6,
        //    end_all_depreciated: 7,
        //    stop_disable: 8,
        //    stop_disable_all: 9
        //};


        var DB_NAME = 'fit-import';
        var DB_VERSION = 1; // Use a long long for this value (don't use a float)

        // Object store
        var RECORD_OBJECTSTORE_NAME = 'records';
        var LAP_OBJECTSTORE_NAME = 'lap';
        var SESSION_OBJECTSTORE_NAME = 'session';
        var HRV_OBJECTSTORE_NAME = 'hrv';

        var db;
        var req;

        // FIT file contains definition rec. followed by data rec.
        var FIT_DEFINITION_MSG = 1;
        var FIT_DATA_MSG = 0;

        // Global msg types.

        var FIT_MSG_FILEID = 0;
        var FIT_MSG_SESSION = 18;
        var FIT_MSG_LAP = 19;
        var FIT_MSG_RECORD = 20;
        var FIT_MSG_EVENT = 21;
        var FIT_MSG_ACTIVITY = 34;
        var FIT_MSG_FILE_CREATOR = 49;
        var FIT_MSG_HRV = 78;
        var FIT_MSG_DEVICE_INFO = 23;
        


        function deleteDb() {
            // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory#deleteDatabase
            // Problem : can only delete indexeddb one time in the same tab
            self.postMessage({ response: "info", data: "deleteDb()" });
            
            var req;
            
            try {
                req=  indexedDB.deleteDatabase(DB_NAME);
            } catch (e) {
                self.postMessage({ response: "error", data: e.message });
            }
            //req.onblocked = function (evt) {
            //    self.postMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
            //}


            req.onsuccess = function (evt) {
                self.postMessage({ response: "info", data: "Success deleting database" });
                openDb();
            };

            req.onerror = function (evt) {
                self.postMessage({ response: "error", data : "Error deleting database" });
            };
                
        }


        function openDb() {
            //console.log("openDb ...");
            self.postMessage({ response: "info", data : "Starting openDb(), version " + DB_VERSION.toString() });
            req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onblocked = function (evt) {
                self.postMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
            }

            req.onsuccess = function (evt) {
                // Better use "this" than "req" to get the result to avoid problems with
                // garbage collection.
                // db = req.result;
                self.postMessage({ response: "info", data : "Success openDb(), version " + DB_VERSION.toString() });
                db = this.result;
                // console.log("openDb DONE");
                // getRawdata();
               
                getRawdata();

                

                //self.close();  // Free resources, terminate worker
            };

            req.onerror = function (evt) {
                //console.error("openDb:", evt.target.errorCode);
                self.postMessage({ response: "error", data : "openDB error " + evt.target.errorCode.toString() });

            };

            req.onupgradeneeded = function (evt) {
                //console.log("openDb.onupgradeneeded");
                self.postMessage({ response: "info", data : "Starting onupgradeneeded, version " + DB_VERSION.toString() });
               // self.postMessage({response : "onupgradeneeded", data : evt});
                var recordStore = evt.currentTarget.result.createObjectStore(RECORD_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement:false });
                var lapStore = evt.currentTarget.result.createObjectStore(LAP_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                var sessionStore = evt.currentTarget.result.createObjectStore(SESSION_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                var hrvStore = evt.currentTarget.result.createObjectStore(HRV_OBJECTSTORE_NAME, { keyPath: 'start_time', autoIncrement: false });

                //getRawdata();
                

                //store.createIndex('timestamp', 'timestamp.value', { unique: true });
                //store.createIndex('title', 'title', { unique: false });
                //store.createIndex('year', 'year', { unique: false });
            };

           
        }


        /**
    * @param {string} store_name
    * @param {string} mode either "readonly" or "readwrite"
    */
        function getObjectStore(store_name, mode) {
            var tx = db.transaction(store_name, mode);
            return tx.objectStore(store_name);
        }



        function addRawdata(store,datarec) {
            //console.log("addPublication arguments:", arguments);
            //var obj = { biblioid: biblioid, title: title, year: year };
            //var obj = {name : "Henning"};

            //if (typeof blob != 'undefined')
            //    obj.blob = blob;
 

            //var overrideObj = { timestamp: new Date().getTime() };

            var req;
            try {
                req = store.add(datarec);
            } catch (e) {
                //if (e.name == 'DataCloneError')
                //    displayActionFailure("This engine doesn't know how to clone a Blob, " +
                //                         "use Firefox");
                throw e;
            }

            //req.transaction.oncompleted = function (evt) {
            //    self.postMessage({ response: "info", data: "Transaction completed" });
            //}

            req.onsuccess = function (evt) {
                //self.postMessage({ response: "importedFITToIndexedDB"});
              //  self.postMessage({ response: "info", data: "Add transaction completed" });
                //console.log("Insertion in DB successful");
                //displayActionSuccess();
                //displayPubList(store);
                //var trans = req.transaction;
                //trans.oncompleted = function (evt) {
                //    s
                //}
                
            };

            req.onerror = function (evt) {
                self.postMessage({ response: "error", data : "Could not write object to store"});
                //console.error("addPublication error", this.error);
                //displayActionFailure(this.error);
            };
        }


        function getRawdata() {
            var rawData = getDataRecords();

            self.postMessage({ response: "rawData", "rawdata": rawData, datamessages: records });

            
            //if (rawData !== undefined)
            //  addRawdata(rawData);

        }

        /**
     * @param {number} key
     * @param {IDBObjectStore=} store
     */
        function deletePublication(key, store) {
            //console.log("deletePublication:", arguments);


            if (typeof store == 'undefined')
                store = getObjectStore(DB_STORE_NAME, 'readwrite');

            // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
            // the result of the Object Store Deletion Operation algorithm is
            // undefined, so it's not possible to know if some records were actually
            // deleted by looking at the request result.
            var req = store.get(key);
            req.onsuccess = function (evt) {
                var record = evt.target.result;
                //console.log("record:", record);
                if (typeof record == 'undefined') {
                    //displayActionFailure("No matching record found");
                    return;
                }
                // Warning: The exact same key used for creation needs to be passed for
                // the deletion. If the key was a Number for creation, then it needs to
                // be a Number for deletion.
                req = store.delete(key);
                req.onsuccess = function (evt) {
                    //console.log("evt:", evt);
                    //console.log("evt.target:", evt.target);
                    //console.log("evt.target.result:", evt.target.result);
                    //console.log("delete successful");
                    //displayActionSuccess("Deletion successful");
                    //displayPubList(store);
                };
                req.onerror = function (evt) {
                    //console.error("deletePublication:", evt.target.errorCode);
                };
            };
            req.onerror = function (evt) {
                //console.error("deletePublication:", evt.target.errorCode);
            };
        }

        

        exposeFunc.readFitFile = function () {
            fitFileReader = new FileReaderSync(); // For web worker

            try {
              fileBuffer = fitFileReader.readAsArrayBuffer(fitFile);

            } catch (e) {
                self.postMessage({ response: "error", data: "Could not initialize fit file reader with bytes"  });
            }

            headerInfo = getFITHeader(fileBuffer,fitFile.size);

            self.postMessage({ response: "header", header: headerInfo });

            deleteDb();

           // openDb();

           


            
           
        }

        getDataRecords = function () {
            var util = FITUtility();
            var aFITBuffer = fileBuffer;
            var dvFITBuffer = new DataView(aFITBuffer);


            var prevIndex = index; // If getDataRecords are called again it will start just after header again

            var rawdata = {}; // Facilitate easy integration with highchart series

            if (headerInfo === undefined)
                return undefined;

            // while (this.index < this.headerInfo.headerSize + this.headerInfo.dataSize) {
            var maxReadToByte = headerInfo.fitFileSystemSize - 2 - prevIndex;

            //var tx = db.transaction([RECORD_OBJECTSTORE_NAME,LAP_OBJECTSTORE_NAME, SESSION_OBJECTSTORE_NAME,HRV_OBJECTSTORE_NAME], "readwrite");
            
            //tx.onerror = function (evt) {
            //    self.postMessage({ response: "error", data: evt });
            //}

            var recordStore = getObjectStore(RECORD_OBJECTSTORE_NAME,"readwrite");
            var lapStore = getObjectStore(LAP_OBJECTSTORE_NAME,"readwrite");
            var sessionStore = getObjectStore(SESSION_OBJECTSTORE_NAME,"readwrite");
            var hrvStore = getObjectStore(HRV_OBJECTSTORE_NAME,"readwrite");

            while (index < headerInfo.fitFileSystemSize - 2 - prevIndex) { // Try reading from file in case something is wrong with header (datasize/headersize) 
                var rec = getRecord(dvFITBuffer, maxReadToByte);

                
                if (rec.header.messageType === FIT_DEFINITION_MSG)
                    localMsgDef["localMsgDefinition" + rec.header.localMessageType.toString()] = rec; // If we got an definition message, store it as a property 
                else {
                    var datarec = getDataRecordContent(rec); // Data record RAW from device - no value conversion (besides scale and offset adjustment)

                    records.push(datarec.globalMessageType); // Store all data globalmessage types contained in FIT file

                    if (datarec.message !== undefined)
                        // Unknown global message 79 recorded by 910XT....
                    {
                        if (rawdata[datarec.message] === undefined)
                            rawdata[datarec.message] = {};

                        //if (datarec.message === "hrv" || datarec.message === "file_id" || datarec.message === "record" || datarec.message === "session" || datarec.message === "lap") {

                        if (datarec.message === "record")
                            addRawdata(recordStore, datarec);

                        if (datarec.message === "lap")
                            addRawdata(lapStore, datarec);

                        if (datarec.message === "session")
                            addRawdata(sessionStore, datarec);

                        for (var prop in datarec) {

                            //if (rec[prop] !== undefined) {
                            //  console.log("Found field " + filter+" i = "+i.toString());

                            //if (rec[prop].value !== undefined) {

                            var val = datarec[prop].value;


                            if (val !== undefined) {

                                if (rawdata[(datarec.message)][prop] === undefined)
                                    rawdata[(datarec.message)][prop] = [];


                                rawdata[datarec.message][prop].push(val);
                            }
                            //else
                            //    data[rec.message][field].push([util.convertTimestampToUTC(timestamp)+timeOffset, val]);
                            // }
                        }
                        //}
                    }
                }
            }

            // Persist hrv data if any

            if (rawdata.hrv !== undefined)
                // Pick start time of first session as key
                addRawdata(hrvStore, { start_time: rawdata.session.start_time[0], time: rawdata.hrv.time });

            index = prevIndex;

            //this.littleEndian = firstRecord.content.littleEndian; // The encoding used for records

            // Unclear if last 2 bytes of FIT file is big/little endian, but based on FIT header CRC is stored in little endian, so
            // it should be quite safe to assume the last two bytes is stored in little endian format
            //var CRC = this.getFITCRC(aFITBuffer.slice(-2), true);

            var CRC = dvFITBuffer.getUint16(aFITBuffer.byteLength - 2, true); // Force little endian
            //console.log("Stored 2-byte is CRC in file is : " + CRC.toString());

            // Not debugged yet...var verifyCRC = fitCRC(dvFITBuffer, 0, this.headerSize + this.dataSize, 0);


            //return JSON.stringify(data);
            db.close(); // Hopefully cleanup and free resources
            return rawdata;
        }


        getDataRecordContent = function (rec) {

            var localMsgType = rec.header.localMessageType.toString();
            var definitionMsg = localMsgDef["localMsgDefinition" + localMsgType];
            var globalMsgType = definitionMsg.content.globalMsgNr;

            var fieldNrs = definitionMsg.content.fieldNumbers;

            var msg = { "message": getGlobalMessageTypeName(globalMsgType) };
            msg.globalMessageType = globalMsgType;

            var logger = "";

            var globalMsg = messageFactory(globalMsgType);

            var util = FITUtility();


            if (globalMsg === undefined)
                
                self.postMessage({ response: "error", data: "Global Message Type " + globalMsgType.toString() + " number unsupported" });
               
            else {

                for (var i = 0; i < fieldNrs; i++) {
                    var field = "field" + i.toString();
                    var fieldDefNr = rec.content[field].fieldDefinitionNumber;

                    // Skip fields with invalid value
                    if (!rec.content[field].invalid) {

                        if (globalMsg[fieldDefNr] !== undefined && globalMsg[fieldDefNr] !== null)
                        {
                            var prop = globalMsg[fieldDefNr].property;

                            var unit = globalMsg[fieldDefNr].unit;
                            var scale = globalMsg[fieldDefNr].scale;
                            var offset = globalMsg[fieldDefNr].offset;
                            var val = rec.content[field].value;

                            if (scale !== undefined)
                                val = val / scale;

                            if (offset !== undefined)
                                val = val - offset;

                            rec.content[field].value = val;

                            // Duplication of code, maybe later do some value conversions here for specific messages
                            switch (globalMsgType) {
                                // file_id
                                case FIT_MSG_FILEID:
                                    if (prop === "time_created")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);
                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;
                                    // session
                                case FIT_MSG_SESSION:
                                    if (prop === "timestamp" || prop === "start_time")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; 
                                    break;

                                    // lap
                                case FIT_MSG_LAP:
                                    if (prop === "timestamp" || prop === "start_time")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                    break;
                                    // record
                                case FIT_MSG_RECORD:
                                   
                                    if (prop === "timestamp")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                    break;

                                    // activity
                                case FIT_MSG_ACTIVITY:
                                    if (prop === "timestamp")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                                    //  file_creator
                                case FIT_MSG_FILE_CREATOR: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                                    // hrv
                                case FIT_MSG_HRV: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                                    // event
                                case FIT_MSG_EVENT:
                                    if (prop === "timestamp")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);
                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                    break;

                                case FIT_MSG_DEVICE_INFO:
                                    if (prop === "timestamp")
                                        rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);
                                    msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                    break;

                                default:
                                    self.postMessage({ response: "error", data: "Not implemented message for global type nr., check messageFactory " + globalMsgType.toString() });
                                    break;
                            }
                        } else
                            
                            self.postMessage({ response: "error", data: "Cannot read property of fieldDefNr " + fieldDefNr.toString() + " on global message type " + globalMsgType.toString() });

                          
                    }


                    logger += fieldDefNr.toString() + ":" + rec.content[field].value.toString();
                    if (rec.content[field].invalid)
                        logger += "(I) ";
                    else
                        logger += " ";
                }

                // Hrv and Records are the most prominent data, so skip these for now too not fill the console.log
                if (globalMsgType != FIT_MSG_RECORD && globalMsgType != FIT_MSG_HRV)
                    self.postMessage({ response: "info", data: "Local msg. type = " + localMsgType.toString() + " linked to global msg. type = " + globalMsgType.toString() + ":" + this.getGlobalMessageTypeName(globalMsgType) + " field values = " + logger });
            }

            return msg;

        }

        getGlobalMessageTypeName = function (globalMessageType) {
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

        messageFactory = function (globalMessageType) {

            var name = getGlobalMessageTypeName(globalMessageType);
            //var fitMsg = FITMessage();
            var fitActivity = FIT.ActivityFile();

            var message = { properties: undefined };

            switch (name) {
                case "file_creator":
                    message.properties = fitActivity.fileCreator();
                    break;
                case "file_id":
                    message.properties = fitActivity.fileId();
                    break;
                case "activity":
                    message.properties = fitActivity.activity();
                    break;
                case "record":
                    message.properties = fitActivity.record();
                    break;
                case "session":
                    message.properties = fitActivity.session();
                    break;
                case "lap":
                    message.properties = fitActivity.lap();
                    break;
                case "hrv":
                    message.properties = fitActivity.hrv();
                    break;
                case "event":
                    message.properties = fitActivity.event();
                    break;
                case "device_info":
                    message.properties = fitActivity.deviceInfo();
                    break;
                default:
                    self.postMessage({ response: "error", data: "No message properties found, global message name : " + name });
                    break;
                    
            }


            return message.properties;



        }

        getFITCRC = function (aCRCBuffer, littleEndian) {
            var dviewFITCRC = new DataView(aCRCBuffer); // Last 2 bytes of .FIT file contains CRC
            return dviewFITCRC.getUint16(0, littleEndian);

        }

        getFITHeader = function (bufFitHeader, fitFileSystemSize) {

            var MAXFITHEADERLENGTH = 14; // FIT Protocol rev 1.3 p. 13

            var dviewFitHeader = new DataView(bufFitHeader);
            // DataView defaults to bigendian MSB --- LSB
            // FIT file header protocol v. 1.3 stored as little endian

            var headerInfo = {
                headerSize: dviewFitHeader.getUint8(0),
                protocolVersion: dviewFitHeader.getUint8(1),       // FIT SDK v5.1 - fit.h - 4-bit MSB = major - 4-bit LSB = minor
                profileVersion: dviewFitHeader.getUint16(2, true),  // FIT SDK v5.1: - fit h. -  major*100+minor
                dataSize: dviewFitHeader.getUint32(4, true)
            };


            headerInfo.protocolVersionMajor = headerInfo.protocolVersion >> 4;
            headerInfo.protocolVersionMinor = headerInfo.protocolVersion & 0x0F;

            headerInfo.profileVersionMajor = Math.floor(headerInfo.profileVersion / 100);
            headerInfo.profileVersionMinor = headerInfo.profileVersion - (headerInfo.profileVersionMajor * 100);

            headerInfo.estimatedFitFileSize = headerInfo.headerSize + headerInfo.dataSize + 2;  // 2 for last CRC
            headerInfo.fitFileSystemSize = fitFileSystemSize;

            // this.dataType = ab2str(bufFitHeader.slice(8, 12)); // Should be .FIT ASCII codes

            headerInfo.dataType = "";
            for (var indx = 8; indx < 12; indx++)
                headerInfo.dataType += String.fromCharCode(dviewFitHeader.getUint8(indx));

            index = 12;

            // Optional header info

            if (headerInfo.headerSize >= MAXFITHEADERLENGTH) {
                headerInfo.headerCRC = dviewFitHeader.getUint16(12, true);
                index += 2;
                //if (this.headerCRC === 0)
                //    console.info("Header CRC was not stored in file");

            }

            return headerInfo;

        };

        getRecord = function (dviewFit, maxReadToByte) {

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

           

            // HEADER

            var HEADERTYPE_FLAG = 0x80;                // binary 10000000 
            var NORMAL_MESSAGE_TYPE_FLAG = 0x40;       // binary 01000000
            var NORMAL_LOCAL_MESSAGE_TYPE_FLAGS = 0xF; // binary 00001111

            // Data message time compressed
            var TIMEOFFSET_FLAGS = 0x1F;                           // binary 00011111 
            var COMPRESSED_TIMESTAMP_LOCAL_MESSAGE_TYPE_FLAGS = 0x60; // binary 01100000 

            recHeader.byte = dviewFit.getUint8(index++);
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
                case FIT_DEFINITION_MSG:
                    //  5 byte FIXED content header
                    recContent.reserved = dviewFit.getUint8(index++); // Reserved = 0
                    recContent.littleEndian = dviewFit.getUint8(index++) === 0; // 0 = little endian 1 = big endian (javascript dataview defaults to big endian!)
                    recContent.globalMsgNr = dviewFit.getUint16(index, recContent.littleEndian); // what kind of data message
                    index = index + 2;
                    recContent.fieldNumbers = dviewFit.getUint8(index++); // Number of fields in data message

                    // VARIABLE content - field definitions as properties

                    for (var fieldNr = 0; fieldNr < recContent.fieldNumbers && index < maxReadToByte - 3 ; fieldNr++)
                        recContent["field" + fieldNr.toString()] = {
                            "fieldDefinitionNumber": dviewFit.getUint8(index++),
                            "size": dviewFit.getUint8(index++),
                            "baseType": dviewFit.getUint8(index++)
                        };

                    //       console.log("Definition message, global message nr. = ", recContent["globalMsgNr"].toString() + " contains " + recContent["fieldNumbers"].toString() + " fields");

                    break;

                case FIT_DATA_MSG: // Lookup in msg. definition in properties -> read fields
                    var localMsgDefinition = localMsgDef["localMsgDefinition" + recHeader.localMessageType.toString()];
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
                                recContent[currentField].value = dviewFit.getUint8(index); break;
                                //case 0x0A: recContent["field" + i.toString()] = { "value": dviewFit.getUint8(this.index++) }; break;
                            case 0x01: recContent[currentField].value = dviewFit.getInt8(index); break;
                            case 0x02: recContent[currentField].value = dviewFit.getUint8(index); break;
                            case 0x83: recContent[currentField].value = dviewFit.getInt16(index, littleEndian); break;
                            case 0x84:
                            case 0x8B:
                                recContent[currentField].value = dviewFit.getUint16(index, littleEndian); break;
                                // recContent["field" + i.toString()] = { "value": dviewFit.getUint16(this.index, littleEndian) }; this.index += 2; break;
                            case 0x85: recContent[currentField].value = dviewFit.getInt32(index, littleEndian); break;
                            case 0x86:
                            case 0x8C:
                                recContent[currentField].value = dviewFit.getUint32(index, littleEndian); break;
                                //recContent["field" + i.toString()] = { "value": dviewFit.getUint32(this.index, littleEndian) }; this.index += 4; break;
                            case 0x07: //console.error("String not implemented yet!");
                                var stringStartIndex = index;
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

                            case 0x88: recContent[currentField].value = dviewFit.getFloat32(index, littleEndian); break;
                            case 0x89: recContent[currentField].value = dviewFit.getFloat64(index, littleEndian); break;
                            case 0x0D: //console.error("Array of bytes not implemented yet!");
                                var bytesStartIndex = index;
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
                        index = index + bSize;
                    }

                    //console.log(logging);//use strict
                    // Will load "Script/FITMessage.js probably since worker is loaded from /Scripts directory
                    importScripts('FITActivityFile.js', 'FITUtility.js');

                    (

                     function () {
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

                                 case 'importFitFile':
                                     var options = {
                                         fitfile: data.fitfile
                                         //,query: data.query,

                                     };

                                     fitFileManager = FitFileImport(options);
                                     fitFileManager.readFitFile();

                                     break;
                                 default:
                                     self.postMessage('Unrecognized command' + data.request);
                                     break;
                             }


                         }, false);


                         function FitFileImport(options) {
                             var exposeFunc = {};


                             // var fitFileManager = this;

                             var fitFile = options.fitfile; // Reference to FIT file in browser - FILE API
                             var index = 0; // Pointer to next unread byte in FIT file
                             var records = []; // Holds every global message nr. contained in FIT file
                             var fileBuffer = {};

                             var fitFileReader;
                             var headerInfo;

                             var index;

                             var localMsgDef = {};

                             //this.query = options.query;


                             //this.event_type = {
                             //    start: 0,
                             //    stop: 1,
                             //    consecutive_depreciated: 2,
                             //    marker: 3,
                             //    stop_all: 4,
                             //    begin_depreciated: 5,
                             //    end_depreciated: 6,
                             //    end_all_depreciated: 7,
                             //    stop_disable: 8,
                             //    stop_disable_all: 9
                             //};


                             var DB_NAME = 'fit-import';
                             var DB_VERSION = 1; // Use a long long for this value (don't use a float)

                             // Object store
                             var RECORD_OBJECTSTORE_NAME = 'records';
                             var LAP_OBJECTSTORE_NAME = 'lap';
                             var SESSION_OBJECTSTORE_NAME = 'session';
                             var HRV_OBJECTSTORE_NAME = 'hrv';

                             var db;
                             var req;

                             // FIT file contains definition rec. followed by data rec.
                             var FIT_DEFINITION_MSG = 1;
                             var FIT_DATA_MSG = 0;

                             // Global msg types.

                             var FIT_MSG_FILEID = 0;
                             var FIT_MSG_SESSION = 18;
                             var FIT_MSG_LAP = 19;
                             var FIT_MSG_RECORD = 20;
                             var FIT_MSG_EVENT = 21;
                             var FIT_MSG_ACTIVITY = 34;
                             var FIT_MSG_FILE_CREATOR = 49;
                             var FIT_MSG_HRV = 78;



                             function deleteDb() {
                                 self.postMessage({ response: "info", data: "deleteDb()" });

                                 var req = indexedDB.deleteDatabase(DB_NAME);

                                 req.onsuccess = function (evt) {
                                     self.postMessage({ response: "info", data: "Success deleting database" });
                                     openDb();
                                 };

                                 req.onerror = function (evt) {
                                     self.postMessage({ response: "error", data: "Error deleting database" });
                                 };

                             }


                             function openDb() {
                                 //console.log("openDb ...");
                                 self.postMessage({ response: "info", data: "Starting openDb(), version " + DB_VERSION.toString() });
                                 req = indexedDB.open(DB_NAME, DB_VERSION);

                                 req.onsuccess = function (evt) {
                                     // Better use "this" than "req" to get the result to avoid problems with
                                     // garbage collection.
                                     // db = req.result;
                                     self.postMessage({ response: "info", data: "Success openDb(), version " + DB_VERSION.toString() });
                                     db = this.result;
                                     // console.log("openDb DONE");
                                     // getRawdata();

                                     getRawdata();
                                 };

                                 req.onerror = function (evt) {
                                     //console.error("openDb:", evt.target.errorCode);
                                     self.postMessage({ response: "error", data: "openDB error " + evt.target.errorCode.toString() });

                                 };

                                 req.onupgradeneeded = function (evt) {
                                     //console.log("openDb.onupgradeneeded");
                                     self.postMessage({ response: "info", data: "Starting onupgradeneeded, version " + DB_VERSION.toString() });
                                     // self.postMessage({response : "onupgradeneeded", data : evt});
                                     var recordStore = evt.currentTarget.result.createObjectStore(RECORD_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                                     var lapStore = evt.currentTarget.result.createObjectStore(LAP_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                                     var sessionStore = evt.currentTarget.result.createObjectStore(SESSION_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                                     var hrvStore = evt.currentTarget.result.createObjectStore(HRV_OBJECTSTORE_NAME, { keyPath: 'start_time', autoIncrement: false });

                                     //getRawdata();


                                     //store.createIndex('timestamp', 'timestamp.value', { unique: true });
                                     //store.createIndex('title', 'title', { unique: false });
                                     //store.createIndex('year', 'year', { unique: false });
                                 };


                             }


                             /**
                         * @param {string} store_name
                         * @param {string} mode either "readonly" or "readwrite"
                         */
                             function getObjectStore(store_name, mode) {
                                 var tx = db.transaction(store_name, mode);
                                 return tx.objectStore(store_name);
                             }



                             function addRawdata(store, datarec) {
                                 //console.log("addPublication arguments:", arguments);
                                 //var obj = { biblioid: biblioid, title: title, year: year };
                                 //var obj = {name : "Henning"};

                                 //if (typeof blob != 'undefined')
                                 //    obj.blob = blob;


                                 //var overrideObj = { timestamp: new Date().getTime() };

                                 var req;
                                 try {
                                     req = store.add(datarec);
                                 } catch (e) {
                                     //if (e.name == 'DataCloneError')
                                     //    displayActionFailure("This engine doesn't know how to clone a Blob, " +
                                     //                         "use Firefox");
                                     throw e;
                                 }

                                 //req.transaction.oncompleted = function (evt) {
                                 //    self.postMessage({ response: "info", data: "Transaction completed" });
                                 //}

                                 req.onsuccess = function (evt) {
                                     //self.postMessage({ response: "importedFITToIndexedDB"});
                                     //  self.postMessage({ response: "info", data: "Add transaction completed" });
                                     //console.log("Insertion in DB successful");
                                     //displayActionSuccess();
                                     //displayPubList(store);
                                     //var trans = req.transaction;
                                     //trans.oncompleted = function (evt) {
                                     //    s
                                     //}

                                 };

                                 req.onerror = function (evt) {
                                     self.postMessage({ response: "error", data: "Could not write object to store" });
                                     //console.error("addPublication error", this.error);
                                     //displayActionFailure(this.error);
                                 };
                             }


                             function getRawdata() {
                                 var rawData = getDataRecords();

                                 self.postMessage({ response: "rawData", "rawdata": rawData, datamessages: records });

                                 //if (rawData !== undefined)
                                 //  addRawdata(rawData);

                             }

                             /**
                          * @param {number} key
                          * @param {IDBObjectStore=} store
                          */
                             function deletePublication(key, store) {
                                 //console.log("deletePublication:", arguments);


                                 if (typeof store == 'undefined')
                                     store = getObjectStore(DB_STORE_NAME, 'readwrite');

                                 // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
                                 // the result of the Object Store Deletion Operation algorithm is
                                 // undefined, so it's not possible to know if some records were actually
                                 // deleted by looking at the request result.
                                 var req = store.get(key);
                                 req.onsuccess = function (evt) {
                                     var record = evt.target.result;
                                     //console.log("record:", record);
                                     if (typeof record == 'undefined') {
                                         //displayActionFailure("No matching record found");
                                         return;
                                     }
                                     // Warning: The exact same key used for creation needs to be passed for
                                     // the deletion. If the key was a Number for creation, then it needs to
                                     // be a Number for deletion.
                                     req = store.delete(key);
                                     req.onsuccess = function (evt) {
                                         //console.log("evt:", evt);
                                         //console.log("evt.target:", evt.target);
                                         //console.log("evt.target.result:", evt.target.result);
                                         //console.log("delete successful");
                                         //displayActionSuccess("Deletion successful");
                                         //displayPubList(store);
                                     };
                                     req.onerror = function (evt) {
                                         //console.error("deletePublication:", evt.target.errorCode);
                                     };
                                 };
                                 req.onerror = function (evt) {
                                     //console.error("deletePublication:", evt.target.errorCode);
                                 };
                             }



                             exposeFunc.readFitFile = function () {
                                 fitFileReader = new FileReaderSync(); // For web worker

                                 try {
                                     fileBuffer = fitFileReader.readAsArrayBuffer(fitFile);

                                 } catch (e) {
                                     self.postMessage({ response: "error", data: "Could not initialize fit file reader with bytes" });
                                 }

                                 headerInfo = getFITHeader(fileBuffer, fitFile.size);

                                 self.postMessage({ response: "header", header: headerInfo });

                                 deleteDb(); // For now delete DB ...

                                 openDb();




                             }

                             getDataRecords = function () {
                                 var util = FITUtility();
                                 var aFITBuffer = fileBuffer;
                                 var dvFITBuffer = new DataView(aFITBuffer);


                                 var prevIndex = index; // If getDataRecords are called again it will start just after header again

                                 var rawdata = {}; // Facilitate easy integration with highchart series

                                 if (headerInfo == undefined)
                                     return undefined;

                                 // while (this.index < this.headerInfo.headerSize + this.headerInfo.dataSize) {
                                 var maxReadToByte = headerInfo.fitFileSystemSize - 2 - prevIndex;

                                 var recordStore = getObjectStore(RECORD_OBJECTSTORE_NAME, 'readwrite');
                                 var lapStore = getObjectStore(LAP_OBJECTSTORE_NAME, 'readwrite');
                                 var sessionStore = getObjectStore(SESSION_OBJECTSTORE_NAME, 'readwrite');
                                 var hrvStore = getObjectStore(HRV_OBJECTSTORE_NAME, 'readwrite');

                                 while (index < headerInfo.fitFileSystemSize - 2 - prevIndex) { // Try reading from file in case something is wrong with header (datasize/headersize) 
                                     var rec = getRecord(dvFITBuffer, maxReadToByte);


                                     if (rec.header.messageType === FIT_DEFINITION_MSG)
                                         localMsgDef["localMsgDefinition" + rec.header.localMessageType.toString()] = rec; // If we got an definition message, store it as a property 
                                     else {
                                         var datarec = getDataRecordContent(rec); // Data record RAW from device - no value conversion (besides scale and offset adjustment)

                                         records.push(rec.globalMessageType); // Store all data globalmessage types contained in FIT file

                                         if (rawdata[datarec.message] === undefined)
                                             rawdata[datarec.message] = {};

                                         if (datarec.message === "hrv" || datarec.message === "file_id" || datarec.message === "record" || datarec.message === "session" || datarec.message === "lap") {

                                             if (datarec.message === "record")
                                                 addRawdata(recordStore, datarec);

                                             if (datarec.message === "lap")
                                                 addRawdata(lapStore, datarec);

                                             if (datarec.message === "session")
                                                 addRawdata(sessionStore, datarec);

                                             for (var prop in datarec) {

                                                 //if (rec[prop] !== undefined) {
                                                 //  console.log("Found field " + filter+" i = "+i.toString());

                                                 //if (rec[prop].value !== undefined) {

                                                 var val = datarec[prop].value;


                                                 if (val !== undefined) {

                                                     if (rawdata[(datarec.message)][prop] === undefined)
                                                         rawdata[(datarec.message)][prop] = [];


                                                     rawdata[datarec.message][prop].push(val);
                                                 }
                                                 //else
                                                 //    data[rec.message][field].push([util.convertTimestampToUTC(timestamp)+timeOffset, val]);
                                                 // }
                                             }
                                         }

                                     }
                                 }

                                 // Persist hrv data if any

                                 if (rawdata.hrv !== undefined)
                                     // Pick start time of first session as key
                                     addRawdata(hrvStore, { start_time: rawdata.session.start_time[0], time: rawdata.hrv.time });

                                 index = prevIndex;

                                 //this.littleEndian = firstRecord.content.littleEndian; // The encoding used for records

                                 // Unclear if last 2 bytes of FIT file is big/little endian, but based on FIT header CRC is stored in little endian, so
                                 // it should be quite safe to assume the last two bytes is stored in little endian format
                                 //var CRC = this.getFITCRC(aFITBuffer.slice(-2), true);

                                 var CRC = dvFITBuffer.getUint16(aFITBuffer.byteLength - 2, true); // Force little endian
                                 //console.log("Stored 2-byte is CRC in file is : " + CRC.toString());

                                 // Not debugged yet...var verifyCRC = fitCRC(dvFITBuffer, 0, this.headerSize + this.dataSize, 0);


                                 //return JSON.stringify(data);

                                 return rawdata;
                             }


                             getDataRecordContent = function (rec) {

                                 var localMsgType = rec.header.localMessageType.toString();
                                 var definitionMsg = localMsgDef["localMsgDefinition" + localMsgType];
                                 var globalMsgType = definitionMsg.content.globalMsgNr;

                                 var fieldNrs = definitionMsg.content.fieldNumbers;

                                 var msg = { "message": getGlobalMessageTypeName(globalMsgType) };
                                 msg.globalMessageType = globalMsgType;

                                 var logger = "";

                                 var globalMsg = messageFactory(globalMsgType);

                                 var util = FITUtility();


                                 if (globalMsg === undefined)

                                     self.postMessage({ response: "error", data: "Global Message Type " + globalMsgType.toString() + " number unsupported" });

                                 else {

                                     for (var i = 0; i < fieldNrs; i++) {
                                         var field = "field" + i.toString();
                                         var fieldDefNr = rec.content[field].fieldDefinitionNumber;

                                         // Skip fields with invalid value
                                         if (!rec.content[field].invalid) {

                                             if (globalMsg[fieldDefNr] !== undefined && globalMsg[fieldDefNr] !== null) {
                                                 var prop = globalMsg[fieldDefNr].property;

                                                 var unit = globalMsg[fieldDefNr].unit;
                                                 var scale = globalMsg[fieldDefNr].scale;
                                                 var offset = globalMsg[fieldDefNr].offset;
                                                 var val = rec.content[field].value;

                                                 if (scale !== undefined)
                                                     val = val / scale;

                                                 if (offset !== undefined)
                                                     val = val - offset;

                                                 rec.content[field].value = val;

                                                 // Duplication of code, maybe later do some value conversions here for specific messages
                                                 switch (globalMsgType) {
                                                     // file_id
                                                     case FIT_MSG_FILEID: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;
                                                         // session
                                                     case FIT_MSG_SESSION:
                                                         if (prop === "timestamp" || prop === "start_time")
                                                             rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                                         msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                                         break;

                                                         // lap
                                                     case FIT_MSG_LAP:
                                                         if (prop === "timestamp" || prop === "start_time")
                                                             rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                                         msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                                         break;
                                                         // record
                                                     case FIT_MSG_RECORD:

                                                         if (prop === "timestamp")
                                                             rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                                                         msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                                         break;

                                                         // activity
                                                     case FIT_MSG_ACTIVITY: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                                                         //  file_creator
                                                     case FIT_MSG_FILE_CREATOR: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                                                         // hrv
                                                     case FIT_MSG_HRV: msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset }; break;

                                                         // event
                                                     case FIT_MSG_EVENT:
                                                         msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                                         break;
                                                     case FIT_MSG_DEVICE_INFO:
                                                         msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };
                                                         break;
                                                     default:
                                                         self.postMessage({ response: "error", data: "Not implemented message for global type nr., check messageFactory " + globalMsgType.toString() });
                                                         break;
                                                 }
                                             } else

                                                 self.postMessage({ response: "error", data: "Cannot read property of fieldDefNr " + fieldDefNr.toString() + " on global message type " + globalMsgType.toString() });


                                         }


                                         logger += fieldDefNr.toString() + ":" + rec.content[field].value.toString();
                                         if (rec.content[field].invalid)
                                             logger += "(I) ";
                                         else
                                             logger += " ";
                                     }

                                     // Hrv and Records are the most prominent data, so skip these for now too not fill the console.log
                                     if (globalMsgType != FIT_MSG_RECORD && globalMsgType != FIT_MSG_HRV)
                                         self.postMessage({ response: "info", data: "Local msg. type = " + localMsgType.toString() + " linked to global msg. type = " + globalMsgType.toString() + ":" + this.getGlobalMessageTypeName(globalMsgType) + " field values = " + logger });
                                 }

                                 return msg;

                             }

                             getGlobalMessageTypeName = function (globalMessageType) {
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

                             messageFactory = function (globalMessageType) {

                                 var name = getGlobalMessageTypeName(globalMessageType);
                                 //var fitMsg = FITMessage();
                                 var fitActivity = FIT.ActivityFile();

                                 var message = { properties: undefined };

                                 switch (name) {
                                     case "file_creator":
                                         message.properties = fitActivity.fileCreator();
                                         break;
                                     case "file_id":
                                         message.properties = fitActivity.fileId();
                                         break;
                                     case "activity":
                                         message.properties = fitActivity.activity();
                                         break;
                                     case "record":
                                         message.properties = fitActivity.record();
                                         break;
                                     case "session":
                                         message.properties = fitActivity.session();
                                         break;
                                     case "lap":
                                         message.properties = fitActivity.lap();
                                         break;
                                     case "hrv":
                                         message.properties = fitActivity.hrv();
                                         break;
                                     case "event":
                                         message.properties = fitActivity.event();
                                         break;
                                         // default: postMessage ("Not supported msg." +name);
                                 }


                                 return message.properties;



                             }

                             getFITCRC = function (aCRCBuffer, littleEndian) {
                                 var dviewFITCRC = new DataView(aCRCBuffer); // Last 2 bytes of .FIT file contains CRC
                                 return dviewFITCRC.getUint16(0, littleEndian);

                             }

                             getFITHeader = function (bufFitHeader, fitFileSystemSize) {

                                 var MAXFITHEADERLENGTH = 14; // FIT Protocol rev 1.3 p. 13

                                 var dviewFitHeader = new DataView(bufFitHeader);
                                 // DataView defaults to bigendian MSB --- LSB
                                 // FIT file header protocol v. 1.3 stored as little endian

                                 var headerInfo = {
                                     headerSize: dviewFitHeader.getUint8(0),
                                     protocolVersion: dviewFitHeader.getUint8(1),       // FIT SDK v5.1 - fit.h - 4-bit MSB = major - 4-bit LSB = minor
                                     profileVersion: dviewFitHeader.getUint16(2, true),  // FIT SDK v5.1: - fit h. -  major*100+minor
                                     dataSize: dviewFitHeader.getUint32(4, true)
                                 };


                                 headerInfo.protocolVersionMajor = headerInfo.protocolVersion >> 4;
                                 headerInfo.protocolVersionMinor = headerInfo.protocolVersion & 0x0F;

                                 headerInfo.profileVersionMajor = Math.floor(headerInfo.profileVersion / 100);
                                 headerInfo.profileVersionMinor = headerInfo.profileVersion - (headerInfo.profileVersionMajor * 100);

                                 headerInfo.estimatedFitFileSize = headerInfo.headerSize + headerInfo.dataSize + 2;  // 2 for last CRC
                                 headerInfo.fitFileSystemSize = fitFileSystemSize;

                                 // this.dataType = ab2str(bufFitHeader.slice(8, 12)); // Should be .FIT ASCII codes

                                 headerInfo.dataType = "";
                                 for (var indx = 8; indx < 12; indx++)
                                     headerInfo.dataType += String.fromCharCode(dviewFitHeader.getUint8(indx));

                                 index = 12;

                                 // Optional header info

                                 if (headerInfo.headerSize >= MAXFITHEADERLENGTH) {
                                     headerInfo.headerCRC = dviewFitHeader.getUint16(12, true);
                                     index += 2;
                                     //if (this.headerCRC === 0)
                                     //    console.info("Header CRC was not stored in file");

                                 }

                                 return headerInfo;

                             }

                             getRecord = function (dviewFit, maxReadToByte) {

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



                                 // HEADER

                                 var HEADERTYPE_FLAG = 0x80;                // binary 10000000 
                                 var NORMAL_MESSAGE_TYPE_FLAG = 0x40;       // binary 01000000
                                 var NORMAL_LOCAL_MESSAGE_TYPE_FLAGS = 0xF; // binary 00001111

                                 // Data message time compressed
                                 var TIMEOFFSET_FLAGS = 0x1F;                           // binary 00011111 
                                 var COMPRESSED_TIMESTAMP_LOCAL_MESSAGE_TYPE_FLAGS = 0x60; // binary 01100000 

                                 recHeader.byte = dviewFit.getUint8(index++);
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
                                     case FIT_DEFINITION_MSG:
                                         //  5 byte FIXED content header
                                         recContent.reserved = dviewFit.getUint8(index++); // Reserved = 0
                                         recContent.littleEndian = dviewFit.getUint8(index++) === 0; // 0 = little endian 1 = big endian (javascript dataview defaults to big endian!)
                                         recContent.globalMsgNr = dviewFit.getUint16(index, recContent.littleEndian); // what kind of data message
                                         index = index + 2;
                                         recContent.fieldNumbers = dviewFit.getUint8(index++); // Number of fields in data message

                                         // VARIABLE content - field definitions as properties

                                         for (var fieldNr = 0; fieldNr < recContent.fieldNumbers && index < maxReadToByte - 3 ; fieldNr++)
                                             recContent["field" + fieldNr.toString()] = {
                                                 "fieldDefinitionNumber": dviewFit.getUint8(index++),
                                                 "size": dviewFit.getUint8(index++),
                                                 "baseType": dviewFit.getUint8(index++)
                                             }

                                         //       console.log("Definition message, global message nr. = ", recContent["globalMsgNr"].toString() + " contains " + recContent["fieldNumbers"].toString() + " fields");

                                         break;

                                     case FIT_DATA_MSG: // Lookup in msg. definition in properties -> read fields
                                         var localMsgDefinition = localMsgDef["localMsgDefinition" + recHeader.localMessageType.toString()];
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
                                                     recContent[currentField].value = dviewFit.getUint8(index); break;
                                                     //case 0x0A: recContent["field" + i.toString()] = { "value": dviewFit.getUint8(this.index++) }; break;
                                                 case 0x01: recContent[currentField].value = dviewFit.getInt8(index); break;
                                                 case 0x02: recContent[currentField].value = dviewFit.getUint8(index); break;
                                                 case 0x83: recContent[currentField].value = dviewFit.getInt16(index, littleEndian); break;
                                                 case 0x84:
                                                 case 0x8B:
                                                     recContent[currentField].value = dviewFit.getUint16(index, littleEndian); break;
                                                     // recContent["field" + i.toString()] = { "value": dviewFit.getUint16(this.index, littleEndian) }; this.index += 2; break;
                                                 case 0x85: recContent[currentField].value = dviewFit.getInt32(index, littleEndian); break;
                                                 case 0x86:
                                                 case 0x8C:
                                                     recContent[currentField].value = dviewFit.getUint32(index, littleEndian); break;
                                                     //recContent["field" + i.toString()] = { "value": dviewFit.getUint32(this.index, littleEndian) }; this.index += 4; break;
                                                 case 0x07: //console.error("String not implemented yet!");
                                                     var stringStartIndex = index;
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

                                                 case 0x88: recContent[currentField].value = dviewFit.getFloat32(index, littleEndian); break;
                                                 case 0x89: recContent[currentField].value = dviewFit.getFloat64(index, littleEndian); break;
                                                 case 0x0D: //console.error("Array of bytes not implemented yet!");
                                                     var bytesStartIndex = index;
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
                                             index = index + bSize;
                                         }

                                         //console.log(logging);

                                         break;
                                 }

                                 record.content = recContent;

                                 return record;
                             }

                             return exposeFunc;

                         }


                     })

                    ();






                    break;
            }

            record.content = recContent;

            return record;
        }

        return exposeFunc;

    }

    
})

();




