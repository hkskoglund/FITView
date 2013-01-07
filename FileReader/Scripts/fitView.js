var FITUI;

window.onload = function () {
    FITUI = new UIController();
    FITUI.setup();
}

function UIController() {

}

UIController.prototype.showSpeedVsHeartRate = function (rawData) {
    var seriesSpeedVsHR = [];
    var minLength;

    if (rawData["heart_rate"] == undefined || rawData["heart_rate"] == null)
        return;

    if (rawData["speed"] == undefined || rawData["speed"] == null)
        return;

    if (rawData["heart_rate"].length == 0)
        return;

    if (rawData["speed"].length == 0)
        return;

    var hrLength = rawData["heart_rate"].length;
    var speedLength = rawData["speed"].length;

    if (hrLength >= speedLength) // Arrays could be of different sizes, cut off
        minLength = speedLength;
    else
        minLengt = hrLength;


    var myZones = getHRZones();

    for (var datap = 0; datap < minLength; datap++) {
        var speedx = rawData["speed"][datap][1];
        var hry = rawData["heart_rate"][datap][1];
        if (speedx == undefined || hry == undefined)
            console.error("Could not access raw data for data point nr. " + datap.toString());
        else {
            seriesSpeedVsHR.push([speedx, hry]);

            // Count Heart rate data points in zone
            for (var zone = 0; zone < myZones.length; zone++) {
                if (hry <= myZones[zone].max && hry >= myZones[zone].min)
                    if (myZones[zone].count == undefined)
                        myZones[zone].count = 1
                    else
                        myZones[zone].count++;
            }


        }
    }

    var divChart = document.getElementById("speedVsHRChart");
    divChart.style.visibility = "visible";

    var chart2 = new Highcharts.Chart({
        chart: {
            renderTo: 'speedVsHRChart',
            type: 'line'
        },
        title: {
            text: ''
        },
        xAxis: {

            //categories : ['Apples', 'Bananas', 'Oranges']
            //type : 'datetime'
        },
        yAxis: {
            title: {
                text: 'bpm'
            }
        },

        series: [{ name: 'Speed vs Heart Rate', data: seriesSpeedVsHR }]

    });

}

UIController.prototype.showCharts = function (rawData,skipTimestamps,chartType) {
    // We get speed in m/s, want it in km/h
    if (rawData["speed"] != undefined)
        rawData["speed"].forEach(function (element, index, array) {
            array[index][1] = element[1] * 3.6;  // Second element is y value, x is first (timestamp)
        });

    var chartId = "testChart";
    var divChart = document.getElementById(chartId);
    divChart.style.visibility = "visible";
    var seriesSetup = [];

    // Record data
    if (rawData["heart_rate"] != undefined)
        seriesSetup.push({ name: 'Heart rate', data: rawData["heart_rate"]})
    if (rawData["altitude"] != undefined)
        seriesSetup.push({ name: 'Altitude', data: rawData["altitude"] });
    if (rawData["cadence"] != undefined)
        seriesSetup.push({ name: 'Cadence', data: rawData["cadence"] });
    if (rawData["speed"] != undefined)
        seriesSetup.push({ name: 'Speed', data: rawData["speed"] });

    // Lap data
    if (rawData["total_ascent"] != undefined)
        seriesSetup.push({ name: 'Total Ascent pr Lap', data: rawData["total_ascent"] });
    if (rawData["total_descent"] != undefined)
        seriesSetup.push({ name: 'Total Decent pr Lap', data: rawData["total_descent"] });
    if (rawData["avg_heart_rate"] != undefined)
        seriesSetup.push({ name: 'Avg. HR pr Lap', data: rawData["avg_heart_rate"] });
    if (rawData["max_heart_rate"] != undefined)
        seriesSetup.push({ name: 'Max. HR pr Lap', data: rawData["max_heart_rate"] });

    // Hrv
    if (rawData["hrv"] != undefined)
        seriesSetup.push({ name: 'Heart rate variability (RR-interval)', data: rawData["hrv"] })

    var xAxisType = 'datetime'
    if (skipTimestamps)
        xAxisType = '';

    chart1 = new Highcharts.Chart({
        chart: {
            renderTo: chartId,
            type: chartType
        },
        title: {
            text: ''
        },
        xAxis: {
            //categories : ['Apples', 'Bananas', 'Oranges']
            type: xAxisType
        },
        yAxis: {
            title: {
                text: ''
            }
        },

        series: seriesSetup

    });


    //FITUI.showSpeedVsHeartRate(rawData);

    //FITUI.showHRZones(rawData);


}

UIController.prototype.showHRZones = function(rawData) {
    var divChart = document.getElementById("zonesChart");
    divChart.style.visibility = "visible";
    
    var options = {
        chart: {
            renderTo: 'zonesChart',
            type: 'bar'
        },
        title: {
            text: ''
        },
        xAxis: {

            //categories: [myZones[0].name, myZones[1].name, myZones[2].name, myZones[3].name, myZones[4].name]
            //type : 'datetime'
        },
        yAxis: {
            title: {
                text: 'Minutes'
            }
        }

        // Assuming 1 sec. sampling of data point -> divide by 60 to get number of minutes in zone
        //series: []
    };


    var myZones = getHRZones();

    for (var datap = 0; datap < rawData["heart_rate"].length; datap++) {
        
        var hry = rawData["heart_rate"][datap][1];
        if (hry == undefined || hry == null)
            console.error("Could not access raw data for data point nr. " + datap.toString());
        else {
            // Count Heart rate data points in zone
            for (var zone = 0; zone < myZones.length; zone++) {
                if (hry <= myZones[zone].max && hry >= myZones[zone].min)
                    if (myZones[zone].count == undefined)
                        myZones[zone].count = 1
                    else
                        myZones[zone].count++;
            }
        }
    }

    var s1 = {};

    s1.name = "Heart rate zones";
    s1.data = [];
    options.xAxis.categories = [];
    options.series = [];

    for (var catNr = 0; catNr < myZones.length; catNr++) {
        options.xAxis.categories.push(myZones[catNr].name);
        s1.data.push([myZones[catNr].name + " (" + myZones[catNr].min.toString() + "-" + myZones[catNr].max.toString() + ")", myZones[catNr].count / 60]);
    }

    options.series.push(s1);

    var chart3 = new Highcharts.Chart(options);
}

//UIController.prototype.showFileInfo = function () { outConsole.innerHTML = '<p>File size: ' + FITUI.fitFileManager.fitFile.size.toString() + ' bytes, last modified: ' + FITUI.fitFileManager.fitFile.lastModifiedDate.toLocaleDateString() + '</p>'; }

UIController.prototype.onFITManagerMsg = function (e) {
    console.log("Got message from worker "+e.data.toString());
}

UIController.prototype.setup = function () {
    // Setup DOM event handling

    // this = #document by default since we are called from $(document).ready event handler

    FITUI.outConsole = document.getElementById('outConsole');

    // Capturing = false -> bubbling event
    FITUI.inpFITFile = document.getElementById('inpFITFile');
    FITUI.inpFITFile.addEventListener('change', FITUI.onFitFileSelected, false);

    FITUI.fitFileManager = new Worker("Scripts/fitFileManager.js")
    FITUI.fitFileManager.addEventListener('message', FITUI.onFITManagerMsg, false);

    //FITUI.btnParse = document.getElementById('btnParse')
    //FITUI.btnParse.addEventListener('click', FITUI.onbtnParseClick, false);


    //FITUI.btnSaveZones = document.getElementById('btnSaveZones')
    //FITUI.btnSaveZones.addEventListener('click', saveHRZones, false);

    FITUI.divMsgMap = document.getElementById('divMsgMap');
   

}

//UIController.prototype.showDataRecordsOnMap = function () {
//    var dataRecords = FITUI.fitFileManager.records;

//    for (var i = 0; i < dataRecords.length; i++) {
//        var styleClass = "";
//        switch (dataRecords[i]) {
//            case 0: styleClass = 'FITfile_id'; break;
//            case 18: styleClass = 'FITsession'; break;
//            case 19: styleClass = 'FITlap'; break;
//            case 20: styleClass = 'FITrecord'; break;
//            case 34: styleClass = 'FITactivity'; break;
            
//            case 78: styleClass = 'FIThrv'; break;
//            default: styleClass = 'FITunknown'; break;
//        }

//        divMsgMap.insertAdjacentHTML("beforeend", '<div class=' + styleClass + '></div>');
//    }
//}

//UIController.prototype.showFITHeader = function () {
//    var headerHtml = '<p>Header size : ' + FITUI.fitFileManager.headerSize.toString() + ' bytes ' +
//'Protocol version : ' + FITUI.fitFileManager.protocolVersion.toString() +
//' Profile version : ' + FITUI.fitFileManager.profileVersion.toString() +
//' Data size: ' + FITUI.fitFileManager.dataSize.toString() + ' bytes' +
//' Data type: ' + FITUI.fitFileManager.dataType;
//    if (FITUI.fitFileManager.headerCRC != undefined) {
//        headerHtml += ' CRC: ' + parseInt(FITUI.fitFileManager.headerCRC, 10).toString(16);
//    }

//    return headerHtml;
//}

// Event handlers

//UIController.prototype.onbtnParseClick = // Callback from button = this
//    function (e) {
//        //var fitManager = new FitFileManager(selectedFiles[0]);
//        //FITUI.showFileInfo();
        
//        FITUI.fitFileManager.loadFile();
//    }

UIController.prototype.fitFileLoadEnd = function (e) {
        try {
           
            FITUI.fitFileManager.setupFITHeader(FITUI.fitFileManager.fitFileReader.result, FITUI.fitFileManager.fitFile.size);
            
            // Start reading records from file
            var rawData = {};


            var rawDataJSON = FITUI.fitFileManager.getDataRecords("record", "heart_rate altitude cadence speed", true, true);
            //FITUI.fitFileManager.parseRecords(rawData, "lap", "total_ascent total_descent avg_heart_rate max_heart_rate", true, true,false);
            //FITUI.fitFileManager.parseRecords(rawData, "hrv", "hrv", true, true, true);
            rawData = JSON.parse(rawDataJSON);

            FITUI.showDataRecordsOnMap();

            FITUI.showCharts(rawData,false,'line');

        } catch (err) {
            console.error('Trouble with FIT file header parsing, message:', err.message);
        }

    }

UIController.prototype.onFitFileSelected = function (e) {
    // console.log(e);
    e.preventDefault();

    FITUI.selectedFiles = e.target.files;

    var fileURL = FITUI.selectedFiles[0];
    //window.URL.revokeObjectURL(fileURL);
    // Maybe can be used to send it to a web worker for background processing
    var msg = { request: 'loadFitFile', data: fileURL };
    FITUI.fitFileManager.postMessage(msg);

    FITUI.fitFileManager.fitFile = FITUI.selectedFiles[0];

    // To do: check file size

    //FITUI.btnParse.style.visibility = 'visible';


}


function saveHRZones(e) {

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

function getHRZones() {
    // Assume browser supports localStorage
    var localStorage = window.localStorage;
    var key = "FITView.HRZones";
    var myZonesJSONString = localStorage.getItem(key);
    
    var myZones;
    if (myZonesJSONString != null)
        myZones = JSON.parse(myZonesJSONString);
    else {
        console.info("Local storage of "+key+" not found, using default HR Zones");
        myZones = [{ name: 'Zone 1', min: 110, max: 120 },   // No storage found use default
                 { name: 'Zone 2', min: 121, max: 140 },
                 { name: 'Zone 3', min: 141, max: 150 },
                 { name: 'Zone 4', min: 151, max: 165 },
                 { name: 'Zone 5', min: 166, max: 256 }];
    }

    return myZones;
}










