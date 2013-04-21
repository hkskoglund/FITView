// Adds property names, scaling and units to data -> intepretation of raw harvested data record
function intepretDataRecord(rec) {

    var localMsgType = rec.header.localMessageType.toString();
    var definitionMsg = localMessageDefinitionCache["localMsgDefinition" + localMsgType];

    if (definitionMsg === undefined) {
        loggMessage({ response: "error", data: "No msg. definition found for local msg. type = " + localMsgType });
        return undefined;
    }

    var globalMsgType = definitionMsg.content.globalMsgNr;

    var fieldNrs = definitionMsg.content.fieldNumbers;

    // loggMessage({ response: "info", data: "Global message nr "+globalMsgType.toString()+" has according to definition message; total field numbers = "+fieldNrs.toString() });


    var logger = "";

    // Fetch new global message template to populate with rawdata values
    var globalMessage = messageFactory(globalMsgType);

    var msg = { "_message": getGlobalMessageTypeName(globalMsgType) };
    msg._globalMessageType = globalMsgType;

    var prop;

    //if (globalMessage === undefined)

    //    loggMessage({ response: "error", data: "Global Message Type " + globalMsgType.toString() + " number unsupported" });

    //else {

    for (var i = 0; i < fieldNrs; i++) {

        var field = "field" + i.toString();

        if (rec.content[field] === undefined) {
            loggMessage({ response: "error", data: "Cannot read content of field " + field + " global message type " + globalMsgType.toString() });
            break;
        }

        var fieldDefNr = rec.content[field].fieldDefinitionNumber;

        // loggMessage({ response: "info", data: "Parsing  " + field +" in record content, it contains data for field definition number"+fieldDefNr });

        // Skip fields with invalid value
        if (!rec.content[field].invalid) {

            if (globalMessage[fieldDefNr]) {
                prop = globalMessage[fieldDefNr].property;

                var unit = globalMessage[fieldDefNr].unit;
                var scale = globalMessage[fieldDefNr].scale;
                var offset = globalMessage[fieldDefNr].offset;
                var val = rec.content[field].value; // Can be an array in case of HRV data - invalid values are skipped in getRecord (raw)

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

                rec.content[field].value = val;

                // Handle timestamps
                if (prop === "timestamp" || prop === "start_time" || prop === "time_created")
                    rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);

                msg[prop] = { "value": rec.content[field].value, "unit": unit, "scale": scale, "offset": offset };

            } else {

                // Allow for auto generating unknown properties than have data (not defined in FITActivitiyFile.js)
                if (fieldDefNr === 253) { // Seems like field def. 253 is always a timestamp
                    prop = "timestamp";
                    rec.content[field].value = util.convertTimestampToUTC(rec.content[field].value);
                } else if (fieldDefNr === 254) { // Probably always message_index - a counter from 0 to n for each message
                    prop = "message_index";
                }

                else {
                    if (fieldDefNr === undefined)
                        fieldDefNr = "undefined";

                    prop = "unknown_fieldDefinitionNr_" + fieldDefNr.toString();
                    loggMessage({ response: "error", data: "Cannot find defining property of fieldDefNr " + fieldDefNr.toString() + " on global message type " + globalMsgType.toString() + " unknown field generated to store data" });
                }

                msg[prop] = { "value": rec.content[field].value };

            }
        }

        logger += fieldDefNr.toString();

        if (rec.content[field].value !== undefined)
            logger += ":" + rec.content[field].value.toString();
        else
            logger += " : undefined";

        if (rec.content[field].invalid)
            logger += "(I) ";
        else
            logger += " ";
    }

    // Hrv and Records are the most prominent data, so skip these for now too not fill the console.log
    if (msg._message !== "record" && msg._message !== "hrv")
        loggMessage({ response: "info", data: "Local msg. type = " + localMsgType.toString() + " linked to global msg. type = " + globalMsgType.toString() + ":" + getGlobalMessageTypeName(globalMsgType) + " field values = " + logger });
    //}

    return msg;

}
