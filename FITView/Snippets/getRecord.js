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
            // Loop through all field definitions and read corresponding fields in data message

            var littleEndian = localMessageDefinition.content.littleEndian;


            // var logging = "";
            var currentField, bType, bSize, numBytesRead;

            for (fieldNr = 0; fieldNr < localMessageDefinition.content.fieldNumbers; fieldNr++) {

                currentField = "field" + fieldNr.toString();
                bType = localMessageDefinition.content[currentField].baseType;
                bSize = localMessageDefinition.content[currentField].size;
                numBytesRead = 0;

                recContent[currentField] = { fieldDefinitionNumber: localMessageDefinition.content[currentField].fieldDefinitionNumber };

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
                    loggMessage({ response: "error", data: "Field " + currentField + " is " + bSize.toString() + " bytes, only read " + numBytesRead.toString() + " bytes. Base type is : " + bType.toString() });

                // Advance to next field value position
                index = index + bSize;


            }

            record.content = recContent;

            // loggMessage({ response: "info", data: "Raw record content of data message : " + JSON.stringify(recContent) });
            break;
    }

    return record;
}
