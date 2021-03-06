﻿// JSHint options
/* global indexedDB:true, FITCRCTimestampUtility:true, importScripts:true, FIT:true, FileReaderSync:true, self:true */
// NB!  self = dedicatedWorkerContext automatically set in the global namespace
importScripts('/Scripts/Messages/FITCommonMessage.js', '/Scripts/Messages/FITActivityFile.js', '/Scripts/Messages/FITSportSetting.js', '/Scripts/Messages/FITSettingsFile.js', '/Scripts/Messages/FITTotalsFile.js','FITCRCTimestampUtility.js');

(
 function () {
     "use strict";

     //var self = this;
    
     var util = FIT.CRCTimestampUtility();

     var fitFileManager = [];

     var workerThreadContext = self;

     
     // console = undefined in worker -> comment out console.* msg

     function messageHandler(e) {
         // We get an MessageEvent of type message = e
         var data = e.data;
         var currentFileBuffer;
         var options;

         if (data.request === undefined) {
             self.postMessage("Undefined command command!");
             return;
         }

         switch (data.request) {

             case 'importFitFile':

                  options = {
                     fitfiles: data.fitfiles,
                     fitfile: data.fitfile,
                     store: data.store,
                     logging: data.logging,
                     demoMode : data.demoMode
                     //,query: data.query,

                 };

                 //if (typeof (options.fitfiles) === "undefined") {  // Only single file
                 //    fitFileManager = new FitFileImport(options);
                 //    currentFileBuffer = fitFileManager.readFitFile();
                 //}

                 // Batch import

                 fitFileManager = new FitFileImport(options);

                 break;

             default:

                 self.postMessage('Unrecognized command' + data.request);
                 break;
         }
     }

     // Listen to events to start import
     self.addEventListener('message', messageHandler , false);


     function FitFileImport(options) {

         var exposeFunc = {},

         // var fitFileManager = this;

          fitFile = options.fitfile, // Reference to FIT file in browser - FILE API
          fitFiles = options.fitfiles,
          storeInIndexedDB = options.store,
          logging = options.logging,

          index = 0, // Pointer to next unread byte in FIT file
          records = [], // Holds every global message nr. contained in FIT file

          fileBuffer = {},

          fitFileReader,
          headerInfo,

          localMessageDefinitionCache = {},

         //this.query = options.query;

          DB_NAME = 'fit-import',
          DB_VERSION = 1, // Use a long long for this value (don't use a float)

         // Object store
          RECORD_OBJECTSTORE_NAME = 'records',
          LAP_OBJECTSTORE_NAME = 'lap',
          SESSION_OBJECTSTORE_NAME = 'session',
          HRV_OBJECTSTORE_NAME = 'hrv',
          ACTIVITY_OBJECTSTORE_NAME = 'activity',
          LENGTH_OBJECTSTORE_NAME = 'length',
          EVENT_OBJECTSTORE_NAME = 'event',
          FILEID_OBJECTSTORE_NAME = 'fileid',
          DEVICEINFO_OBJECTSTORE_NAME = 'deviceinfo',
          META_OBJECTSTORE_NAME = 'meta',

          recordStore, lapStore, sessionStore, hrvStore, activityStore, lengthStore, eventStore, fileidStore, deviceinfoStore, metaStore,   db,

         // FIT file contains definition rec. followed by data rec.
          FIT_DEFINITION_MSG = 1,
          FIT_DATA_MSG = 0,

         // From table 4-6 p. 22 in D00001275 Flexible & Interoperable Data Transfer (FIT) Protocol Rev 1.3

          fitBaseTypesInvalidValues = {

             0x00: {
                 "name": "enum",
                 "invalidValue": 0xFF
             },

             0x01: {
                 "name": "sint8",
                 "invalidValue": 0x7F
             },

             0x02: {
                 "name": "uint8",
                 "invalidValue": 0xFF
             },

             0x83: {
                 "name": "sint16",
                 "invalidValue": 0x7FFF
             },

             0x84: {
                 "name": "uint16",
                 "invalidValue": 0xFFFF
             },

             0x85: {
                 "name": "sint32",
                 "invalidValue": 0x7FFFFFFF
             },

             0x86: {
                 "name": "uint32",
                 "invalidValue": 0xFFFFFFFF
             },

             0x07: {
                 "name": "string",
                 "invalidValue": 0x00
             },

             0x88: {
                 "name": "float32",
                 "invalidValue": 0xFFFFFFFF
             },

             0x89: {
                 "name": "float64",
                 "invalidValue": 0xFFFFFFFFFFFFFFFF
             },

             0x0A: {
                 "name": "uint8z",
                 "invalidValue": 0x00
             },

             0x8B: {
                 "name": "uint16z",
                 "invalidValue": 0x0000
             },

             0x8C: {
                 "name": "uint32z",
                 "invalidValue": 0x00000000
             },

             0x0D: {
                 "name": "byte",
                 "invalidValue": 0xFF
             }
         };

         function loggMessage(msg) {
             if (logging)
                 self.postMessage(msg);
         }


        function deleteDb() {
             // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory#deleteDatabase

            if (storeInIndexedDB) {
                loggMessage({ response: "info", data: "deleteDb()" });

                var req;

                //indexedDB = indexedDB || mozIndexedDB;
                try {
                    req = indexedDB.deleteDatabase(DB_NAME);
                } catch (e) {
                    loggMessage({ response: "error", data: e.message });
                }
                //req.onblocked = function (evt) {
                //    loggMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
                //}


                req.onsuccess = function (evt) {
                    loggMessage({ response: "info", data: "Success deleting database" });
                };

                req.onerror = function (evt) {
                    loggMessage({ response: "error", data: "Error deleting database" });
                };
            }
         }


         function openDb(callback) {
             var rawData;
             var req;
             //console.log("openDb ...");
             if (storeInIndexedDB) {
                 loggMessage({ response: "info", data: "Starting openDb(), version " + DB_VERSION.toString() });
                 req = indexedDB.open(DB_NAME, DB_VERSION);

                 req.onblocked = function (evt) {
                     loggMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
                 };

                 req.onsuccess = function (evt) {
                     // Better use "this" than "req" to get the result to avoid problems with
                     // garbage collection.
                     // db = req.result;
                     loggMessage({ response: "info", data: "Success openDb(), version " + DB_VERSION.toString() });
                     db = this.result;

                     // Main handler for DB errors - takes care of bubbling events 
                     db.onerror = function (evt) {
                         loggMessage({
                             response: "error", data: "Database error "
                         });
                         //+ evt.target.errorCode.toString()

                     };
                     // console.log("openDb DONE");
                     callback();
                     // getRawdata();

                     // rawData = getRawdata(fileBuffer);

                     //self.close();  // Free resources, terminate worker
                 };

                 req.onerror = function (evt) {
                     //console.error("openDb:", evt.target.errorCode);
                     loggMessage({ response: "error", data: "openDB error " + evt.target.errorCode.toString() });

                 };

                 req.onupgradeneeded = function (evt) {
                     //console.log("openDb.onupgradeneeded");
                     loggMessage({ response: "info", data: "Starting onupgradeneeded, version " + DB_VERSION.toString() });
                     // loggMessage({response : "onupgradeneeded", data : evt});
                     recordStore = evt.currentTarget.result.createObjectStore(RECORD_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                     lapStore = evt.currentTarget.result.createObjectStore(LAP_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                     sessionStore = evt.currentTarget.result.createObjectStore(SESSION_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                     hrvStore = evt.currentTarget.result.createObjectStore(HRV_OBJECTSTORE_NAME, { keyPath: 'start_time', autoIncrement: false });
                     activityStore = evt.currentTarget.result.createObjectStore(ACTIVITY_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                     lengthStore = evt.currentTarget.result.createObjectStore(LENGTH_OBJECTSTORE_NAME, { keyPath: 'start_time.value', autoIncrement: false });
                     eventStore = evt.currentTarget.result.createObjectStore(EVENT_OBJECTSTORE_NAME, { keyPath: 'timestamp.value', autoIncrement: false });
                     fileidStore = evt.currentTarget.result.createObjectStore(FILEID_OBJECTSTORE_NAME, { keyPath: 'time_created.value', autoIncrement: false });
                     deviceinfoStore = evt.currentTarget.result.createObjectStore(DEVICEINFO_OBJECTSTORE_NAME, { autoIncrement: true });
                     metaStore = evt.currentTarget.result.createObjectStore(META_OBJECTSTORE_NAME, { keyPath: 'fitFile.name' });
                     //getRawdata();


                     deviceinfoStore.createIndex('timestamp', 'timestamp.value', { unique: false }); // Several device_indexes can have same timestamp
                     //store.createIndex('title', 'title', { unique: false });
                     //store.createIndex('year', 'year', { unique: false });
                 };
             } else
                 callback();
         }

         /**
     * @param {string} store_name
     * @param {string} mode either "readonly" or "readwrite"
     */
         function getObjectStore(store_name, mode) {
             if (storeInIndexedDB) {
                 var tx = db.transaction(store_name, mode);
                 return tx.objectStore(store_name);
             } else
                 return undefined;
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
                 req = {};
                 if (storeInIndexedDB)
                     req = store.add(datarec);
             } catch (e) {
                 //if (e.name == 'DataCloneError')
                 //    displayActionFailure("This engine doesn't know how to clone a Blob, " +
                 //                         "use Firefox");
                 //throw e;
                 loggMessage({ response: "error", data: "Could not write data to objectstore, global msg. = " + datarec._message + ", event = " + e.toString(), event: e });
             }

             //req.transaction.oncompleted = function (evt) {
             //    loggMessage({ response: "info", data: "Transaction completed" });
             //}

             req.onsuccess = function (evt) {
                 //loggMessage({ response: "importedFITToIndexedDB"});
                 //  loggMessage({ response: "info", data: "Add transaction completed" });
                 //console.log("Insertion in DB successful");
                 //displayActionSuccess();
                 //displayPubList(store);
                 //var trans = req.transaction;
                 //trans.oncompleted = function (evt) {
                 //    s
                 //}

             };

             req.onerror = function (evt) {
                 var errMsg = datarec._message;
                 if (errMsg !== undefined) {
                     if (datarec.timestamp !== undefined)
                         errMsg += " timestamp " + datarec.timestamp.value.toString();
                     if (datarec.time_created !== undefined)
                         errMsg += " time_created " + datarec.time_created.value.toString();
                     if (datarec.start_time !== undefined)
                         errMsg += " start_time " + datarec.start_time.value.toString();
                 }

                 loggMessage({ response: "error", data: "Could not write object to store, message = " + errMsg });
                 //console.error("addPublication error", this.error);
                 //displayActionFailure(this.error);
             };
         }


         function getRawdata(fileBuffer,fitFile) {

             var rawData, type, headerInfo = getFITHeader(fileBuffer, fitFile);

             if (isFIT(headerInfo)) {
                 // Store header to indexedDB
                 //loggMessage({ response: "header", header: headerInfo });

                 var metaStore = getObjectStore(META_OBJECTSTORE_NAME, "readwrite");
                 addRawdata(metaStore, headerInfo);

                 rawData = getFITDataRecords(fileBuffer, headerInfo);
                 if (typeof (rawData) === "undefined")
                     rawData = {}; // Allow for hooking up headerinfo on rawdata object

                 rawData._headerInfo_ = headerInfo;

             }
             else {
                 type = fitFile.type;
                 if (typeof type === "undefined")
                     type = "Undefined";
                 loggMessage({ response: "error", data: "File " + fitFile.name + " of type " + fitFile.type + ", does not have a .FIT datatype in header, cannot process this file." });
             }

            

             // Will send undefined if not .FIT datatype

             //if (self.webkitPostMessage)
             //    self.webkitpostMessage({ response: "rawData", "rawdata": rawData, datamessages: records, file: fitFile });
             //else
                 self.postMessage({ response: "rawData", "rawdata": rawData, datamessages: records, file: fitFile });

             return rawData;

         }

      //   /**
      //* @param {number} key
      //* @param {IDBObjectStore=} store
      //*/
      //   function deletePublication(key, store) {
      //       //console.log("deletePublication:", arguments);


      //       if (typeof store === 'undefined')
      //           store = getObjectStore(DB_STORE_NAME, 'readwrite');

      //       // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
      //       // the result of the Object Store Deletion Operation algorithm is
      //       // undefined, so it's not possible to know if some records were actually
      //       // deleted by looking at the request result.
      //       var req = store.get(key);
      //       req.onsuccess = function (evt) {
      //           var record = evt.target.result;
      //           //console.log("record:", record);
      //           if (typeof record === 'undefined') {
      //               //displayActionFailure("No matching record found");
      //               return;
      //           }
      //           // Warning: The exact same key used for creation needs to be passed for
      //           // the deletion. If the key was a Number for creation, then it needs to
      //           // be a Number for deletion.
      //           req = store.delete(key);
      //           req.onsuccess = function (evt) {
      //               //console.log("evt:", evt);
      //               //console.log("evt.target:", evt.target);
      //               //console.log("evt.target.result:", evt.target.result);
      //               //console.log("delete successful");
      //               //displayActionSuccess("Deletion successful");
      //               //displayPubList(store);
      //           };
      //           req.onerror = function (evt) {
      //               //console.error("deletePublication:", evt.target.errorCode);
      //           };
      //       };
      //       req.onerror = function (evt) {
      //           //console.error("deletePublication:", evt.target.errorCode);
      //       };
      //   }

         function getFITDataRecords(fileBuffer,headerInfo) {

             var dvFITBuffer = new DataView(fileBuffer);

             var prevIndex = index; // If getDataRecords are called again it will start just after header again

             var rawdata = {}; // Facilitate easy integration with highchart series

             var fileidRec; // Synthesis of file_id and file_creator messages (file_creator only has only two properties; software/hardware)

             var speedDistanceRecs = []; // Records of swim speed/distance record without timestamp --> try adding as property to session

             // while (this.index < this.headerInfo.headerSize + this.headerInfo.dataSize) {
            
             var maxReadToByte = headerInfo.fitFile.size - 2;

             //var tx = db.transaction([RECORD_OBJECTSTORE_NAME,LAP_OBJECTSTORE_NAME, SESSION_OBJECTSTORE_NAME,HRV_OBJECTSTORE_NAME], "readwrite");

             //tx.onerror = function (evt) {
             //    loggMessage({ response: "error", data: evt });
             //}

             var recordStore = getObjectStore(RECORD_OBJECTSTORE_NAME, "readwrite");
             var lapStore = getObjectStore(LAP_OBJECTSTORE_NAME, "readwrite");
             var sessionStore = getObjectStore(SESSION_OBJECTSTORE_NAME, "readwrite");
             var hrvStore = getObjectStore(HRV_OBJECTSTORE_NAME, "readwrite");
             var activityStore = getObjectStore(ACTIVITY_OBJECTSTORE_NAME, "readwrite");
             var lengthStore = getObjectStore(LENGTH_OBJECTSTORE_NAME, "readwrite");
             var eventStore = getObjectStore(EVENT_OBJECTSTORE_NAME, "readwrite");
             var fileidStore = getObjectStore(FILEID_OBJECTSTORE_NAME, "readwrite");
             //fileidStore.transaction.oncomplete = function (evt) {
             //    loggMessage({ response: "info", data: "file id transaction complete" });
             //}
             var deviceinfoStore = getObjectStore(DEVICEINFO_OBJECTSTORE_NAME, "readwrite");
             //deviceinfoStore.transaction.oncomplete = function (evt) {
             //    loggMessage({ response: "info", data: "device info transaction complete" });
             //}

             var prevTimestamp;
             var TIMESTAMP_THRESHOLD = 60 * 60 * 1000; // 60 minute max. threshold for acceptable consequtive timestamps
             var unacceptableTimestamp = false;

             var prevLat;
             var prevLong;

             var SEMICIRCLE_THRESHOLD = 1520000;
             var unacceptableLat = false;
             var unacceptableLong = false;

             // Try instead to use a generic counter aggregate with an increment function
             var newCounter = {
                 increment: function (globalMessage) {
                     if (typeof this[globalMessage] === "undefined")
                         this[globalMessage] = 1;
                     else
                         this[globalMessage]++;
                 }
             };

             var progressHandle;

             progressHandle = setInterval(function () {
                 self.postMessage({ response: "importProgress", data: Math.floor(index / maxReadToByte * 100) });
             }, 1000);

             while (index < maxReadToByte) { // Try reading from file in case something is wrong with header (datasize/headersize) 

                 var FITrecord = getRecord(dvFITBuffer, maxReadToByte); 

                 if (FITrecord.record.header.messageType === FIT_DATA_MSG) {
               
                     var datarec = FITrecord.message;

                     if (datarec !== undefined) {

                         records.push(datarec._globalMessageType); // Store all data globalmessage types contained in FIT file

                         if (datarec._message !== undefined) {
                             if (rawdata[datarec._message] === undefined)
                                 rawdata[datarec._message] = {};

                             newCounter.increment(datarec._message);

                             unacceptableTimestamp = false;
                             unacceptableLat = false;
                             unacceptableLong = false;

                             // Presist data to indexedDB
                             switch (datarec._message) {

                                 // Common

                                 case "file_id":
                                     // Well formed .FIT should have one file_id at the start
                                   
                                     fileidRec = datarec;
                                     // addRawdata(fileidStore, datarec);
                                     break;
                                 case "file_creator":
                                     
                                     // Seems rather redudant, same info. is also in device_info record
                                     if (fileidRec !== undefined) {
                                         fileidRec.file_creator = datarec;

                                     } else
                                         loggMessage({ response: "error", data: "file_creator msg. found, but not file_id, skipped saving" });
                                     break;

                                     // Activity
                                 case "record":
                                     if (datarec.timestamp !== undefined) {

                                         // Check timestamp
                                         if (prevTimestamp !== undefined)
                                             if (Math.abs(datarec.timestamp.value - prevTimestamp.value) >= TIMESTAMP_THRESHOLD) {
                                                 unacceptableTimestamp = true;
                                                 loggMessage({ response: "error", data: "Unacceptable timestamp found, filtering out this" });
                                             }

                                         // Check position_lat

                                         if (datarec.position_lat !== undefined && datarec.position_long !== undefined) {
                                             if (prevLat !== undefined)
                                                 if (Math.abs(datarec.position_lat.value - prevLat.value) >= SEMICIRCLE_THRESHOLD) {
                                                     unacceptableLat = true;
                                                     loggMessage({ response: "error", data: "Unacceptable latitude found, filtering out this" });
                                                 }

                                             // Check pos. long

                                             if (prevLong !== undefined && datarec.position_long.value !== undefined)
                                                 if (Math.abs(datarec.position_long.value - prevLong.value) >= SEMICIRCLE_THRESHOLD) {
                                                     unacceptableLong = true;
                                                     loggMessage({ response: "error", data: "Unacceptable longitude found, filtering out this" });
                                                 }
                                         }

                                         if (!unacceptableTimestamp && !unacceptableLat && !unacceptableLong) {
                                          
                                             prevTimestamp = datarec.timestamp;
                                             prevLat = datarec.position_lat;
                                             prevLong = datarec.position_long;
                                             addRawdata(recordStore, datarec);
                                         }


                                     }
                                     else {
                                         speedDistanceRecs.push(datarec);
                                         //loggMessage({ response: "error", data: "No timestamp found in message record (probably swim data - speed/distance), skipped saving" });
                                     }
                                     break;
                                 case "lap":
                                    
                                     if (datarec.timestamp !== undefined)
                                         addRawdata(lapStore, datarec);
                                     else
                                         loggMessage({ response: "error", data: "No timestamp found in lap message, not written to indexedDB" });
                                     break;
                                 case "session":
                                  
                                     if (speedDistanceRecs.length >= 1)
                                         datarec.speedDistanceRecord = speedDistanceRecs;

                                     addRawdata(sessionStore, datarec);
                                     break;
                                 case "activity":
                                    
                                     if (datarec.timestamp !== undefined)
                                         if (!isNaN(datarec.timestamp.value))
                                             addRawdata(activityStore, datarec);
                                         else
                                             loggMessage({ response: "error", data: "Got timestamp NaN, activity record not written to indexedDB" });
                                     break;
                                 case "length":
                                     //loggMessage({ response: "info", data: "Found length message" });
                                     //addRawdata(lengthStore, datarec);
                                    
                                     if (datarec.start_time !== undefined)
                                         addRawdata(lengthStore, datarec);
                                     else
                                         loggMessage({ response: "error", data: "No start_time found in message : length, cannot save to indexedDB" });

                                     break;
                                 case "event":
                                    
                                     if (datarec.timestamp !== undefined)
                                         addRawdata(eventStore, datarec);
                                     else
                                         loggMessage({ response: "error", data: "No timestamp in event message, not written to indexedDB" });
                                     break;

                                 case "device_info":
                                    
                                     addRawdata(deviceinfoStore, datarec);
                                     break;

                                 case "hrv":
                                   
                                     break;


                             }

                             // Build rawdata structure tailored for integration with Highcharts

                             if (!unacceptableTimestamp && !unacceptableLat && !unacceptableLong) {

                                 for (var prop in datarec) {

                                     if (typeof datarec[prop].value !== "undefined")
                                         var val = datarec[prop].value;
                                     else
                                         continue; // Skip these, they don't have a .value property

                                     if (val !== undefined) {

                                         // Initialize rawdata for message and property if necessary
                                         if (rawdata[(datarec._message)][prop] === undefined)
                                             rawdata[(datarec._message)][prop] = [];

                                         if (typeof val === "object" && typeof val.length !== "undefined") // Array of values, i.e HRV/RR
                                         {
                                             var itemNr;
                                             var len = val.length;
                                             for (itemNr = 0; itemNr < len; itemNr++) {
                                                 rawdata[datarec._message][prop][newCounter[datarec._message] - 1] = val[itemNr];
                                                 if (itemNr < len - 1)  // Don't advance at end
                                                     newCounter.increment(datarec._message);
                                             }
                                         }
                                         else
                                             rawdata[datarec._message][prop][newCounter[datarec._message] - 1] = val;  // Single value
                                         
                                     }
                                     else
                                         loggMessage({ response: "warn", data: "Tried to access " + prop.toString() + ".value on " + datarec.message + ", but it was undefined" });
                                 }
                             }
                             
                         } else
                             loggMessage({ response: "info", data: "Unknown global message skipped " + datarec._globalMessageType.toString() });
                     }
                 }
             }

             clearInterval(progressHandle);

             //self.postMessage({ response: "importFinished", data: 100 });
             // self.postMessage({ response: "messageCounter", counter: counter });

             // Strip off increment method
             delete newCounter.increment;
             rawdata._msgCounter_ = newCounter;
             // Persist file_id msg.

             if (fileidRec !== undefined)
                 if (fileidRec.time_created !== undefined)
                     addRawdata(fileidStore, fileidRec);
                 else
                     loggMessage({ response: "error", data: "Undefined time_created in file_id record, cannot save to indexedDB, skipped" });

             // Persist hrv data if any

             if (rawdata.hrv !== undefined)
                 // Pick start time of first session as key
                 addRawdata(hrvStore, { start_time: rawdata.session.start_time[0], time: rawdata.hrv.time });

             index = prevIndex;

             //this.littleEndian = firstRecord.content.littleEndian; // The encoding used for records

             //return JSON.stringify(data);
             //db.close(); // Hopefully cleanup and free resources
             return rawdata;
         }

         

         function getGlobalMessageTypeName(globalMessageType) {
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
             };

             
             var globalMessage = mesg_num[globalMessageType];

             // Handle case where we don't find message name
             if (globalMessage === undefined)
                 globalMessage = "globalMessage" + globalMessageType.toString();

             return globalMessage;
         }

         function messageFactory(globalMessageType) {
             // Maybe can be improved by allowing a configuration file thats loaded at runtime defining properties for each global msg.
             var name = getGlobalMessageTypeName(globalMessageType);
             //var fitMsg = FITMessage();
             var fitActivity = FIT.ActivityFile();
             var fitCommonMsg = FIT.CommonMessage();
             var fitSportMsg = FIT.SportSettingMessage();
             var fitSettingMsg = FIT.SettingsFileMessage();
             var fitTotalsMsg = FIT.TotalsFileMessage();

             var message = { properties: undefined };

             switch (name) {
                 // Common Messages
                 case "file_creator":
                     message.properties = fitCommonMsg.fileCreator();
                     break;

                 case "file_id":
                     message.properties = fitCommonMsg.fileId();
                     break;

                     // Activity messages
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
                 case "length":
                     message.properties = fitActivity.length();
                     break;

                     // Sport settings file messages

                 case "zones_target":
                     message.properties = fitSportMsg.zones_target();
                     break;

                 case "sport":
                     message.properties = fitSportMsg.sport();
                     break;

                 case "hr_zone":
                     message.properties = fitSportMsg.hr_zone();
                     break;
                 case "speed_zone":
                     message.properties = fitSportMsg.speed_zone();
                     break;
                 case "cadence_zone":
                     message.properties = fitSportMsg.cadence_zone();
                     break;
                 case "power_zone":
                     message.properties = fitSportMsg.power_zone();
                     break;
                 case "met_zone":
                     message.properties = fitSportMsg.met_zone();
                     break;

                     // Settings file messages

                 case "device_settings":
                     message.properties = fitSettingMsg.device_settings();
                     break;

                 case "user_profile":
                     message.properties = fitSettingMsg.user_profile();
                     break;

                 case "hrm_profile":
                     message.properties = fitSettingMsg.hrm_profile();
                     break;

                 case "sdm_profile":
                     message.properties = fitSettingMsg.sdm_profile();
                     break;

                 case "bike_profile":
                     message.properties = fitSettingMsg.bike_profile();
                     break;

                     // Totals file messages

                 case "totals":
                     message.properties = fitTotalsMsg.totals();
                     break;
                 

                 default:
                     loggMessage({ response: "error", data: "No message properties found, global message type : " + globalMessageType });
                     message.properties = {};
                     break;

             }

             return message.properties;

         }

         function isFIT(headerInfo) {
             return (headerInfo.dataType === ".FIT");
         }

         function getFITHeader(arrayBufferFITFile, fitFile) {

             var MAXFITHEADERLENGTH = 14; // FIT Protocol rev 1.3 p. 13

             var dviewFitHeader = new DataView(arrayBufferFITFile);
             // DataView defaults to bigendian MSB --- LSB
             // FIT file header protocol v. 1.3 stored as little endian

             var headerInfo = {
                 // Extra meta data added (timestamp, fitfile)
                 timestamp: new Date().getTime(),
                 fitFile: {
                     size: fitFile.size,
                     name: fitFile.name
                 },
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

             headerInfo.dataType = "";
             for (var indx = 8; indx < 12; indx++)
                 headerInfo.dataType += String.fromCharCode(dviewFitHeader.getUint8(indx));

             if (!isFIT(headerInfo))
                 loggMessage({ response: "error", data: "Header reports data type " + headerInfo.dataType.toString() + ", expected .FIT." });

             var firstPartOfHeaderLength = 12;
             index = firstPartOfHeaderLength;

             // Optional header info, header CRC

             if (headerInfo.headerSize >= MAXFITHEADERLENGTH) {
                 headerInfo.headerCRC = dviewFitHeader.getUint16(12, true);
                 index += 2;
                 if (headerInfo.headerCRC === 0)
                     loggMessage({ response: "info", data: "Header CRC was not stored in the file" });
                 else {
                     headerInfo.verifyHeaderCRC = util.fitCRC(dviewFitHeader, 0, firstPartOfHeaderLength, 0);
                     if (headerInfo.verifyHeaderCRC !== headerInfo.headerCRC)
                         loggMessage({ response: "error", data: "Header CRC (bigendian) =" + headerInfo.headerCRC.toString(16) + ", but verified CRC (bigendian) =" + headerInfo.verifyHeaderCRC.toString(16) });
                 }

             }

             // Unclear if last 2 bytes of FIT file is big/little endian, but based on FIT header CRC is stored in little endian, so
             // it should be quite safe to assume the last two bytes is stored in little endian format

             var fileLength = arrayBufferFITFile.byteLength;
             var CRCbytesLength = 2;

             headerInfo.CRC = dviewFitHeader.getUint16(fileLength - CRCbytesLength, true); // Force little endian
             loggMessage({ response: "info", data: "Stored 16-bit CRC at end FIT file is (MSBLSB=bigendian) : " + headerInfo.CRC.toString(16) });

             headerInfo.verifyCRC = util.fitCRC(dviewFitHeader, 0, fileLength - CRCbytesLength, 0);

             if (headerInfo.CRC !== headerInfo.verifyCRC)
                 loggMessage({ response: "error", data: "Verification of CRC gives a value of (MSBLSB=bigendian) : " + headerInfo.verifyCRC.toString(16) + " that does not match CRC stored at end of file." });

             return headerInfo;

         }

         // Get raw FIT record
         function getRecord(dviewFit, maxReadToByte) {

             var fieldNr;

             var recHeader = {};
             var recContent = {};
             var record = {};

             var FIT_NORMAL_HEADER = 0;
             var FIT_COMPRESSED_TIMESTAMP = 1;

             // HEADER

             var HEADERTYPE_FLAG = 0x80;                // binary 10000000 
             var NORMAL_MESSAGE_TYPE_FLAG = 0x40;       // binary 01000000
             var NORMAL_LOCAL_MESSAGE_TYPE_FLAGS = 0xF; // binary 00001111

             // Data message time compressed
             var TIMEOFFSET_FLAGS = 0x1F;                           // binary 00011111 
             var COMPRESSED_TIMESTAMP_LOCAL_MESSAGE_TYPE_FLAGS = 0x60; // binary 01100000 

             recHeader.byte = dviewFit.getUint8(index++);
             recHeader.headerType = (recHeader.byte & HEADERTYPE_FLAG) >> 7; // MSB 7 0 = normal header, 1 = compressed timestampheader

             var msg;

             switch (recHeader.headerType) {

                 // FIXED HEADER

                 case FIT_NORMAL_HEADER: // Normal header
                     recHeader.messageType = (recHeader.byte & NORMAL_MESSAGE_TYPE_FLAG) >> 6; // bit 6 - 1 = definition, 0 = data msg.
                     // bit 5 = 0 reserved
                     // bit 4 = 0 reserved
                     recHeader.localMessageType = recHeader.byte & NORMAL_LOCAL_MESSAGE_TYPE_FLAGS; // bit 0-3

                     break;
                 case FIT_COMPRESSED_TIMESTAMP: // Compressed timestamp header - only for data records
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

                     var fdefNr, fsize, fbtype;
                     for (fieldNr = 0; fieldNr < recContent.fieldNumbers && index < maxReadToByte - 3 ; fieldNr++) {

                         fdefNr = dviewFit.getUint8(index++);
                         fsize = dviewFit.getUint8(index++);
                         fbtype = dviewFit.getUint8(index++);

                         if (fdefNr === undefined || fsize === undefined || fbtype === undefined) {
                             loggMessage({ response: "error", data: "Undefined field - field def. nr/size/basetype, index is " + index.toString() });
                             break;
                         }

                         recContent["field" + fieldNr.toString()] = {
                             fieldDefinitionNumber: fdefNr,
                             size: fsize,
                             baseType: fbtype
                         };
                     }

                  
                     record.content = recContent;

                     // Update local message definition cache
                     localMessageDefinitionCache["localMessageDefinition" + record.header.localMessageType.toString()] = record; // If we got an definition message, store it as a property


                     loggMessage({ response: "info", data: "Raw record content of definition message : " + JSON.stringify(recContent) });

                     //       console.log("Definition message, global message nr. = ", recContent["globalMsgNr"].toString() + " contains " + recContent["fieldNumbers"].toString() + " fields");

                     break;

                 case FIT_DATA_MSG: // Lookup in msg. definition in properties -> read fields

                     var localMessageDefinition = localMessageDefinitionCache["localMessageDefinition" + recHeader.localMessageType.toString()];
                     if (localMessageDefinition === undefined || localMessageDefinition === null) {
                         //  throw new Error("Could not find message definition of data message - local message type = " + recHeader.localMessageType.toString());
                         loggMessage({ response: "error", data: "Could not find message definition of data message - local message type = " + recHeader.localMessageType.toString() });
                         break;

                     }

                     var globalMsgType = localMessageDefinition.content.globalMsgNr;
                     // Fetch new global message template to populate with rawdata values
                     var globalMessage = messageFactory(globalMsgType);

                     msg = { "_message": getGlobalMessageTypeName(globalMsgType) };
                     msg._globalMessageType = globalMsgType;

                     var prop;

                     // Loop through all field definitions and read corresponding fields in data message

                     var littleEndian = localMessageDefinition.content.littleEndian;


                     // var logging = "";
                     var currentField, bType, bSize, numBytesRead, fieldDefNr;

                     for (fieldNr = 0; fieldNr < localMessageDefinition.content.fieldNumbers; fieldNr++) {

                         currentField = "field" + fieldNr.toString();
                         bType = localMessageDefinition.content[currentField].baseType;
                         bSize = localMessageDefinition.content[currentField].size;
                         numBytesRead = 0;
                         fieldDefNr = localMessageDefinition.content[currentField].fieldDefinitionNumber;

                         recContent[currentField] = { fieldDefinitionNumber: fieldDefNr };

                         if (fitBaseTypesInvalidValues[bType] === undefined || fitBaseTypesInvalidValues[bType] === null) {
                             loggMessage({ response: "error", data: "Base type not found for base type " + bType + " reported size is " + bSize + " bytes." });
                             recContent[currentField].invalid = true;
                             // Advance to next field value position
                             index = index + bSize;
                             continue;
                         }

                         if (index + bSize - 1 > maxReadToByte + 1) {
                             loggMessage({ response: "error", data: "Attempt to read field beyond end of file, index is " + index.toString() + ", can max read to : " + maxReadToByte.toString() + ", size of field is " + bSize.toString() + " bytes" });
                             break;
                         }

                         // Read data from typed buffer
                         switch (bType) {
                             case 0x00:
                             case 0x0A:
                                 recContent[currentField].value = dviewFit.getUint8(index);
                                 numBytesRead = 1;
                                 break;

                             case 0x01: recContent[currentField].value = dviewFit.getInt8(index);
                                 numBytesRead = 1;
                                 break;

                             case 0x02: recContent[currentField].value = dviewFit.getUint8(index);
                                 numBytesRead = 1;
                                 break;

                             case 0x83: recContent[currentField].value = dviewFit.getInt16(index, littleEndian);
                                 numBytesRead = 2;
                                 break;
                                 // HRV 0x84 = 132 dec, reports size 10 bytes, we only read 2 bytes here...probably bug -> consequence : can miss 4 hrv time values here...
                                 // Symptom: truncated hrv data in time
                                 // JSON stringify
                                 //"{"header":{"byte":71,"headerType":0,"messageType":1,"localMessageType":7},
                                 //"content":{"reserved":0,"littleEndian":true,"globalMsgNr":78,"fieldNumbers":1,"field0":{"fieldDefinitionNumber":0,"size":10,"baseType":132}}}"
                                 // Conclusion : it seems like max 5 hrv time values are stored in 10 bytes
                             case 0x84: // Dec. 132 - type uint16 = 2 bytes
                                 var uint16Arr = [];
                                 var uint16;
                                 var uint16ToRead = bSize / 2;
                                 var uintNr;
                                 var tempIndex = index;
                                 //loggMessage({ response: "info", data: "Type 0x84/132 = uint16, numbers to read is:"+uint16ToRead.toString() });
                                 for (uintNr = 0; uintNr < uint16ToRead; uintNr++) {
                                     uint16 = dviewFit.getUint16(tempIndex, littleEndian);
                                     numBytesRead += 2;
                                     if (fitBaseTypesInvalidValues[bType].invalidValue !== uint16)  // Just skip invalid values (used for HRV array of uint16)
                                       uint16Arr.push(uint16);
                                     tempIndex += 2;
                                 }

                                 
                                 if (uint16Arr.length === 1) {
                                   
                                     recContent[currentField].value = uint16Arr[0];
                                 }
                                 else if (uint16Arr.length > 1) {
                                   
                                     recContent[currentField].value = uint16Arr;
                                 } else if (uint16Arr.length === 0) { // In case a uint16 field of size 2 bytes with invalid value -> field is marked with .invalid = true (see later)
                                     recContent[currentField].value = uint16;
                                 }
                                 
                                 break;

                             case 0x8B:
                                 recContent[currentField].value = dviewFit.getUint16(index, littleEndian);
                                 numBytesRead = 2;
                                 break;

                             case 0x85: recContent[currentField].value = dviewFit.getInt32(index, littleEndian);
                                 numBytesRead = 4;
                                 break;

                             case 0x86:
                             case 0x8C:
                                 recContent[currentField].value = dviewFit.getUint32(index, littleEndian);
                                 numBytesRead = 4;
                                 break;

                             // String
                             case 0x07:
                                 var stringStartIndex = index;
                                 var str = "";
                                 for (var charNr = 0; charNr < bSize; charNr++) {
                                     var char = dviewFit.getUint8(stringStartIndex++);
                                     if (char === 0) // Null terminated string
                                         break;
                                     str += String.fromCharCode(char);
                                 }
                                 


                                 recContent[currentField].value = str;
                                 numBytesRead = str.length;
                                 break;

                             case 0x88: recContent[currentField].value = dviewFit.getFloat32(index, littleEndian);
                                 numBytesRead = 4;
                                 break;

                             case 0x89: recContent[currentField].value = dviewFit.getFloat64(index, littleEndian);
                                 numBytesRead = 8;
                                 break;

                             // Byte array
                             case 0x0D:
                                 var bytesStartIndex = index;
                                 var bytes = [];
                                 for (var byteNr = 0; byteNr < bSize; byteNr++)
                                     bytes.push(dviewFit.getUint8(bytesStartIndex++));

                                 recContent[currentField].value = bytes;
                                 numBytesRead = bytes.length;
                                 break;

                             default:
                                 loggMessage({ response: "error", data: "Base type " + bType.toString() + " not found in lookup switch" });
                                 break;
                         }

                         // Did we get an invalid value?

                         if (fitBaseTypesInvalidValues[bType].invalidValue === recContent[currentField].value)
                             recContent[currentField].invalid = true;
                         else
                             recContent[currentField].invalid = false;

                         if (numBytesRead !== bSize)
                             loggMessage({ response: "error", data: "Field "+currentField+" is "+bSize.toString()+" bytes, only read "+numBytesRead.toString()+" bytes. Base type is : "+bType.toString()});

                         // Advance to next field value position
                         index = index + bSize;

                         // Skip fields with invalid value
                         if (!recContent[currentField].invalid) {

                             if (globalMessage[fieldDefNr]) {
                                 prop = globalMessage[fieldDefNr].property;

                                 var unit = globalMessage[fieldDefNr].unit;
                                 var scale = globalMessage[fieldDefNr].scale;
                                 var offset = globalMessage[fieldDefNr].offset;
                                 var val = recContent[currentField].value; // Can be an array in case of HRV data - invalid values are skipped in getRecord (raw)

                                 if (typeof val === "object" && typeof val.length !== "undefined") // Probably array
                                 {
                                     var itemNr;
                                     var len = val.length;
                                     for (itemNr = 0; itemNr < len; itemNr++) {
                                         if (scale !== undefined)
                                             val[itemNr] = val[itemNr] / scale;

                                         if (offset !== undefined)
                                             val[itemNr] = val[itemNr] - offset;
                                     }
                                 } else {
                                     if (scale !== undefined)
                                         val = val / scale;

                                     if (offset !== undefined)
                                         val = val - offset;
                                 }

                                 recContent[currentField].value = val;

                                 // Handle timestamps
                                 if (prop === "timestamp" || prop === "start_time" || prop === "time_created")
                                     recContent[currentField].value = util.convertTimestampToUTC(recContent[currentField].value);

                                 msg[prop] = { "value": recContent[currentField].value, "unit": unit, "scale": scale, "offset": offset };

                             } else {

                                 // Allow for auto generating unknown properties than have data (not defined in FITActivitiyFile.js)
                                 if (fieldDefNr === 253) { // Seems like field def. 253 is always a timestamp
                                     prop = "timestamp";
                                     recContent[currentField].value = util.convertTimestampToUTC(recContent[currentField].value);
                                 } else if (fieldDefNr === 254) { // Probably always message_index - a counter from 0 to n for each message
                                     prop = "message_index";
                                 }

                                 else {
                                     if (fieldDefNr === undefined)
                                         fieldDefNr = "undefined";

                                     prop = "unknown_fieldDefinitionNr_" + fieldDefNr.toString();
                                     loggMessage({ response: "error", data: "Cannot find defining property of fieldDefNr " + fieldDefNr.toString() + " on global message type " + globalMsgType.toString() + " unknown field generated to store data" });
                                 }

                                 msg[prop] = { "value": recContent[currentField].value };

                             }
                         }
                     }

                     record.content = recContent;
                    

                     // loggMessage({ response: "info", data: "Raw record content of data message : " + JSON.stringify(recContent) });
                     break;
             }
             
             return {
                 "record": record,
                 "message": msg
             };
         }

         // Open database and import files in callback
         openDb(function () {
             var callbackThis = this;
             var fileNr, len;
             if (typeof options.fitfiles !== "undefined")
               len = options.fitfiles.length;
             var fileBuffers = [];
             var fitFileReader;
             var rawData;
             var status_OK = 200;

            

             if (typeof options.demoMode !== "undefined" && options.demoMode) {
                 // http://www.html5rocks.com/en/tutorials/file/xhr2/
                 // Had some initial problems with reading .FIT file -> it was not configured for IIS 8 mime type -> added .bin type instead for handling of binary file
                 // Windows azure will not transfer .bin files by default -> trying .png/faking an image
                 var xhr = new XMLHttpRequest();
                 var demoFITName = '/Demo/20130311-171014-1-1328-ANTFS-4-0-FIT.png';
                 xhr.open('GET', demoFITName , true);
                 xhr.responseType = 'arraybuffer';

                 xhr.onload = function (e) {

                     if (this.status == status_OK) {
                         rawData = getRawdata(this.response, { name: 'demoFIT', size: this.response.byteLength }); // Implicitly sends data to requesting process via postMessage 
                     } else
                         loggMessage({ response: "error", data: "Tried to load " + demoFITName + ", but status is: " + this.status + " " + this.statusText });

                     // Should'nt store demo storeInIndexedDB should be false
                     //if (storeInIndexedDB && db)
                     //    db.close();

                     self.postMessage({ response: "importFinished", data: 100 });
                 };

                 xhr.onerror = function (e) {
                     loggMessage({ response: "error", data: "Error when accessing " + demoFITName + ", status is: " + this.status + " " + this.statusText });
                 }

                 xhr.send();
                
             } else {
                 fitFileReader = new FileReaderSync();
                 for (fileNr = 0; fileNr < len; fileNr++) {
                     //fitFileReader = new FileReaderSync(); // For web worker, hopefully used readers are released from memory by GC, have not tried shared single reader
                     try {
                         fileBuffers.push(fitFileReader.readAsArrayBuffer(options.fitfiles[fileNr]));

                         rawData = getRawdata(fileBuffers[fileNr], options.fitfiles[fileNr]); // Implicitly sends data to requesting process via postMessage 
                     } catch (e) {
                         loggMessage({ response: "error", data: "Could not initialize fit file reader with bytes", event: e });
                     }
                 }
                 if (storeInIndexedDB && db)
                     db.close();

                 self.postMessage({ response: "importFinished", data: 100 });
                
                 
             }

            

            
            
         });

     }
 }
) // Func. expression

(); // Self-invoking function


