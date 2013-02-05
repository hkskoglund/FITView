//use strict

(function () {

    var FITUI;

    window.onload = function () {
        FITUI = new UIController();
        
    };

    function UIController() {

        if (!Modernizr.webworkers) {
            alert("This application will not work due to lack of webworker functionality");
        }

        if (!Modernizr.indexeddb) {
            alert("This application will not work due to lack of indexedDB");
        }

        if (!Modernizr.geolocation) {
            alert("This application will not work due to lack of geolocation");
        }

      
        this.inpFITFile = document.getElementById('inpFITFile');
        this.inpFITFile.addEventListener('change', this.onFitFileSelected, false);

        //FITUI.btnSaveZones = document.getElementById('btnSaveZones')
        //FITUI.btnSaveZones.addEventListener('click', saveHRZones, false);

        this.divMsgMap = document.getElementById('divMsgMap');

        this.progressFITImport = document.getElementById('progressFITImport');

        this.divSessionLap = $('#divSessionLap');

    }

    UIController.prototype.showSpeedVsHeartRate = function (rawData) {
        var seriesSpeedVsHR = [];
        var minLength;

        if (rawData["heart_rate"] === undefined || rawData["heart_rate"] === null)
            return;

        if (rawData["speed"] === undefined || rawData["speed"] === null)
            return;

        if (rawData["heart_rate"].length === 0)
            return;

        if (rawData["speed"].length === 0)
            return;

        var hrLength = rawData["heart_rate"].length;
        var speedLength = rawData["speed"].length;

        if (hrLength >= speedLength) // Arrays could be of different sizes, cut off
            minLength = speedLength;
        else
            minLength = hrLength;


        var myZones = getHRZones();

        for (var datap = 0; datap < minLength; datap++) {
            var speedx = rawData["speed"][datap][1];
            var hry = rawData["heart_rate"][datap][1];
            if (speedx === undefined || hry === undefined)
                console.error("Could not access raw data for data point nr. " + datap.toString());
            else {
                seriesSpeedVsHR.push([speedx, hry]);

                // Count Heart rate data points in zone
                for (var zone = 0; zone < myZones.length; zone++) {
                    if (hry <= myZones[zone].max && hry >= myZones[zone].min)
                        if (myZones[zone].count === undefined)
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

    };

    function combine(values, timestamps,startTimestamp,endTimestamp) {
        var util = FITUtility();
        var combined = [];

        if (timestamps == undefined) {
            console.warn("Found no timestamps to combine with data measurements.");
            return values;
        }

        if (values.length !== timestamps.length)
            console.warn("Length of arrays to combine is not of same size; values length = " + values.length.toString() + " timestamp length = " + timestamps.length.toString());

        
       
        for (var nr = 0; nr <= values.length; nr++) {
            
            var timestamp = timestamps[nr];
            if (timestamp >= startTimestamp && timestamp <= endTimestamp) {
                if (values[nr] !== undefined)
                    combined.push([util.addTimezoneOffsetToUTC(timestamps[nr]), values[nr]]);
                else
                    console.log("Timestamp ", timestamp, " value is undefined at index",nr);
            }
                if (timestamp > endTimestamp)
                break;
           
        }

        return combined;
      
    }

    function verifyTimestamps(timestamps) {
        var valid = true;
        var len = timestamps.length;

        for (var index = 0; index < len - 1; index++)
            if (timestamps[index + 1] < timestamps[index]) {
                valid = false;
                break;
            }

        return valid;
    }

    UIController.prototype.showChartsDatetime = function (rawData,startTimestamp,endTimestamp) {

        var self = this;
        var util = FITUtility();
       

        var chartId = "testChart";
        var divChart = document.getElementById(chartId);
        divChart.style.visibility = "visible";
        var seriesSetup = [];

        var prevMarker = null; // Holds previous marker for tracking position during mouse move/over

        // Record data

        if (rawData.record) {

            if (rawData.record.heart_rate)
                seriesSetup.push({ name: 'Heart rate', data: combine(rawData.record.heart_rate, rawData.record.timestamp,startTimestamp,endTimestamp), id: 'heartrateseries' });
            
            if (rawData.record.altitude)
                seriesSetup.push({ name: 'Altitude', data: 
                    combine(rawData.record.altitude, rawData.record.timestamp,startTimestamp,endTimestamp),
                });
            
            //if (rawData.record["cadence"] !== undefined)
            //    seriesSetup.push({ name: 'Cadence', data: combine(rawData.record["cadence"], rawData.record["timestamp"]) });
            
            //if (rawData.record.speed) {
            //   // Convert to km/h
            //   for (var relTimestamp = 0; relTimestamp <=  rawData.record.speed.length; relTimestamp++)
            //       rawData.record.speed[relTimestamp] = rawData.record.speed[relTimestamp] * 3.6;

            //    seriesSetup.push({ name: 'Speed', data: combine(rawData.record.speed, rawData.record.timestamp,startTimestamp,endTimestamp) });
            //}
        }

        //if (rawData.lap != undefined) {
        //    // Lap data
        //    if (rawData.lap["total_ascent"] !== undefined)
        //        seriesSetup.push({ name: 'Total Ascent pr Lap', data: rawData.lap["total_ascent"] });
        //    if (rawData.lap["total_descent"] !== undefined)
        //        seriesSetup.push({ name: 'Total Decent pr Lap', data: rawData.lap["total_descent"] });
        //    if (rawData.lap["avg_heart_rate"] !== undefined)
        //        seriesSetup.push({ name: 'Avg. HR pr Lap', data: rawData.lap["avg_heart_rate"] });
        //    if (rawData.lap["max_heart_rate"] !== undefined)
        //        seriesSetup.push({ name: 'Max. HR pr Lap', data: rawData.lap["max_heart_rate"] });
        //}



        //// Test flags

        //seriesSetup.push({
        //    type: 'flags',
        //    onSeries: 'heartrateseries',
        //    data: [{
        //        x: 0,
        //        text: 'First heart rate',
        //        title: 'I'
        //    }],
        //    width: 16,
        //    showInLegend: false
        //});

        var xAxisType = 'datetime';

        var chartOptions = {
            renderTo: chartId,
            type: 'line',
            // Allow zooming
            zoomType: 'xy'

        };
        //if (rawData.hrv !== undefined)
        //    chartOptions.inverted = true;

        var d = new Date();
        console.log("Starting highchart now " + d);
        //var progressInSec = 0;
        //$("#progressFITimport").show();
        //var intervalTimerID = setInterval(function () {
        //    FITUI.progressFITimportViewModel.progressFITimport(++progressInSec);
        //},2000);
            
       


        chart1 = new Highcharts.Chart({
            chart: chartOptions,
            
            title: {
                text: ''
            },
            xAxis: {
                //categories : ['Apples', 'Bananas', 'Oranges']
                type: xAxisType
                //reversed : true
            },
            yAxis: {
                title: {
                    text: ''
                }
            },

            tooltip: {
                //xDateFormat: '%Y-%m-%d',
                formatter: function () {
                    //http://stackoverflow.com/questions/3885817/how-to-check-if-a-number-is-float-or-integer
                    function isInt(n) {
                        return n % 1 === 0;
                    }
                    if (isInt(this.y))
                        return Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' + '<b>' + this.series.name + '</b>' + ': ' + this.y;
                    else
                        return Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' + '<b>' + this.series.name + '</b>' + ': ' + Highcharts.numberFormat(this.y, 1);

                }
            },

            plotOptions: {
                series: {
                    allowPointSelect: true,
                    point: {

                        events: {

                            select: function () {
                                console.log(Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x), this.y)
                            },

                            mouseOver: function () {
                                var lat, long;

                                if (rawData.record != undefined) {
                                    
                                    var index = rawData.record.timestamp.indexOf(this.x-util.getTimezoneOffsetFromUTC());
                                    if (index === -1) {
                                        console.error("Could not find index of timestamp ", this.x);
                                        return;
                                    }

                                    setMarker = function () {
                                        if (typeof (google) === "undefined") // Allows working without map
                                            return;

                                        prevMarker = new google.maps.Marker({
                                            position: new google.maps.LatLng(util.semiCirclesToDegrees(lat), util.semiCirclesToDegrees(long)),
                                            icon: {
                                                path: google.maps.SymbolPath.CIRCLE,
                                                scale: 3
                                            },
                                            draggable: true,
                                            map: self.map
                                        });
                                    }

                                    if (rawData.record.position_lat != undefined)
                                        lat = rawData.record.position_lat[index];

                                    if (rawData.record.position_long != undefined)
                                        long = rawData.record.position_long[index];

                                    //console.log("Lat, long ", lat, long);

                                    if (prevMarker === null) {
                                        setMarker();
                                    } else {
                                        // Clear previous marker
                                        prevMarker.setMap(null);
                                        prevMarker = null;
                                        setMarker();
                                    }

                                    
                                }
                            },

                            mouseOut: function () {
                                if (prevMarker !== undefined && prevMarker !== null) {
                                    prevMarker.setMap(null);
                                    prevMarker = null; // GC takes over...
                                }
                            }
                        }

                    }
                }
            },

            series: seriesSetup



        }


            //, function () {
            ////callback action
            //alert('Something is happening now....');
    //    }
    );

        //clearInterval(intervalTimerID);
       
        d = new Date();
        console.log("Finishing highcharts now " + d);


        //FITUI.showSpeedVsHeartRate(rawData);

        FITUI.showHRZones(rawData,startTimestamp,endTimestamp);


    };

    UIController.prototype.showChartHrv = function (rawData) {
        var chartId = "hrvChart";
        var divChart = document.getElementById(chartId);
        //divChart.style.visibility = "visible";
        var seriesSetup = [];

        if (rawData.hrv !== undefined) {
            if (rawData.hrv.time !== undefined) {

                //chartType = 'bar';
                // Seems like line rendering is much faster than bar...
                //divChart.style.visibility = 'visible';
                divChart.style.display = 'block';
                seriesSetup.push({ name: 'Heart rate variability (RR-interval)', data: rawData.hrv.time });
            }

        }
        else {
            divChart.style.display = 'none';
            return;
        }

        var xAxisType = '';

        var chartOptions = {
            renderTo: chartId,
            type: 'line',
            // Allow zooming
            zoomType: 'xy'
        };


        var chart1 = new Highcharts.Chart({
            chart: chartOptions,
            title: {
                text: 'Heart rate variability'
            },
            xAxis: {
                //categories : ['Apples', 'Bananas', 'Oranges']
                type: xAxisType,
                //reversed : true
                events: {
                    setExtremes: function (event) {
                        console.log("setExtremes xAxis ", event.min, event.max);
                    }
                }
            },
            yAxis: {
                title: {
                    text: ''
                },
                events: {
                    setExtremes: function (event) {
                        console.log("setExtremes yAxis ", event.min, event.max);
                    }
                }
            },

            series: seriesSetup

        });


    };

    UIController.prototype.showHRZones = function (rawdata, startTimestamp, endTimestamp) {
        var divChartId = 'zonesChart';
        var divChart = document.getElementById(divChartId);
        divChart.style.visibility = "visible";

        //var options = {
        //    chart: {
        //        renderTo: 'zonesChart',
        //        type: 'bar'
        //    },
        //    title: {
        //        text: ''
        //    },
        //    xAxis: {

        //        //categories: [myZones[0].name, myZones[1].name, myZones[2].name, myZones[3].name, myZones[4].name]
        //        //type : 'datetime'
        //    },
        //    yAxis: {
        //        title: {
        //            text: 'Minutes'
        //        }
        //    }

        //    // Assuming 1 sec. sampling of data point -> divide by 60 to get number of minutes in zone
        //    //series: []
        //};

        // http://highcharts.com/demo/column-stacked
        var options = {
            chart: {
                renderTo: divChartId,
                type: 'column'
            },
            title: {
                text: ''
            },
            xAxis: {
                
                //categories: ['Apples', 'Oranges', 'Pears', 'Grapes', 'Bananas']
                categories: ['HR Zones']
            },
            yAxis: {
                min: 0,
                title: {
                    text: ''
                },
                stackLabels: {
                    enabled: false,
                    style: {
                        fontWeight: 'bold',
                        color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
                    }
                }
            },
            legend: {
                enabled : false },
            //legend: {
            //    align: 'right',
            //    x: -100,
            //    verticalAlign: 'top',
            //    y: 20,
            //    floating: true,
            //    backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColorSolid) || 'white',
            //    borderColor: '#CCC',
            //    borderWidth: 1,
            //    shadow: false
            //},
            tooltip: {
                formatter: function() {
                    return this.series.name + ': ' + Highcharts.numberFormat(this.y, 1);
                        
                }
            },
            plotOptions: {
                column: {
                    stacking: 'normal',
                    dataLabels: {
                        enabled: false,
                        color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white'
                    }
                }
            }
            //series: [{
            //    name: 'John',
            //    data: [5, 3, 4, 7, 2]
            //}, {
            //    name: 'Jane',
            //    data: [2, 2, 3, 2, 1]
            //}, {
            //    name: 'Joe',
            //    data: [3, 4, 4, 2, 5]
            //}]
        };


        var myZones = getHRZones();

        var startIndex = getIndexOfTimestamp(rawdata.record,startTimestamp);
        var endIndex = getIndexOfTimestamp(rawdata.record,endTimestamp);


        for (var zone = 0; zone < myZones.length; zone++) 
            myZones[zone].timeInZone = 0;

        var timeInZoneMillisec;
        var maxTimeDifference = 60000;  

        for (var datap = startIndex; datap <= endIndex; datap++) {

            // var hry = rawData["heart_rate"][datap][1];

           

            if (datap < endIndex) {
                timeInZoneMillisec = rawdata.record.timestamp[datap + 1] - rawdata.record.timestamp[datap];
                // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/isNaN

                if (isNaN(timeInZoneMillisec)) {// Should not happen....
                    console.error("Time in zone is NaN");
                    break;
                }

                if (timeInZoneMillisec > maxTimeDifference) {
                    console.warn("Greater than ", maxTimeDifference, "ms difference between timestamps, skipped");
                    continue;
                }

            } else if (datap === endIndex)
                timeInZoneMillisec = 1000;


            var hry;
            
            if (rawdata.record.heart_rate !== undefined)
                hry = rawdata.record.heart_rate[datap];
            else
                hry = undefined;

            if (hry === undefined || hry === null)
                console.error("Could not access heart rate raw data for record.timestamp " + rawdata.record.timestamp[datap].toString()+" at index "+datap.toString());
            else {
                // Count Heart rate data points in zone
                for (var zone = 0; zone < myZones.length; zone++) 
                    if (hry <= myZones[zone].max && hry >= myZones[zone].min) {

                        myZones[zone].timeInZone += timeInZoneMillisec;
                    //    console.log("HR ", hry, " time in zone", timeInZone, " zone ", zone, " total time (ms) ", myZones[zone].timeInZone);
                    }
             }
        }

        options.series = [];

        var timeInSecs;
        for (var catNr = myZones.length-1; catNr >= 0; catNr--) {
        
           // s1.data.push([myZones[catNr].name + " (" + myZones[catNr].min.toString() + "-" + myZones[catNr].max.toString() + ")", myZones[catNr].count / 60]);
           // timeInSecs = parseFloat(((myZones[catNr].timeInZone) / 60000).toFixed(1));
            
            timeInSecs = myZones[catNr].timeInZone / 60000;

            options.series.push({
                name: myZones[catNr].name ,
                data: [timeInSecs]
            });
        }

      
        var chart3 = new Highcharts.Chart(options);
    }

    UIController.prototype.showSessionMarkers = function (map, rawdata) {
        // Plot markers for start of each session
        var self = this;

        var util = FITUtility();

        var sessionStartPosFound = false;

        var mapCenterSet = false;

        var session = rawdata.session;

        setMapCenter = function (sport,lat,long) {
            var latlong = new google.maps.LatLng(util.semiCirclesToDegrees(lat), util.semiCirclesToDegrees(long));
            console.info("Setting map center for sport ",sport," at ",latlong);
            map.setCenter(latlong);
            
            if (self.sessionMarkers === undefined || self.sessionMarkers === null)
                self.sessionMarkers = [];

            var markerOptions = {
                position: latlong,
                map: map
            };

            // Select session marker according to sport mode
            var image;

            function newMarkerImage(imageName) {
                return new google.maps.MarkerImage(imageName,
                        new google.maps.Size(32, 32),
                        new google.maps.Point(0, 0),
                        new google.maps.Point(0, 32));
            }

            //generic 0
            //running 1
            //cycling 2
            //transition 3 - Multisport transition
            //fitness_equipment 4
            //swimming 5
            //basketball 6
            //soccer 7
            //tennis 8
            //american_football 9
            //training 10
            //all 254 All is for goals only to include all sports.

            
            switch (sport) {
                case FITSport.running:
                    
                    image = newMarkerImage('Images/sport/running.png');
                    break;
                case FITSport.cycling:
                    image = newMarkerImage('Images/sport/cycling.png');
                    break;

                case FITSport.swimming:
                    image = newMarkerImage('Images/sport/swimming.png');
                    break;
                    // TO DO : Add more icons
            }

            if (image)
                markerOptions.icon = image;
           
            self.sessionMarkers.push(new google.maps.Marker(markerOptions));
        };
        
        // Clear previous session markers
        if (self.sessionMarkers)
        {
            self.sessionMarkers.forEach(function (element, index, array) {
                element.setMap(null);
            });

            self.sessionMarkers = null;
        }

        if (session && session.start_position_lat)
            {
        
                session.start_position_lat.forEach(function (element, index, array) {

                    var lat = element;
                    var long = session.start_position_long[index];

                    if (lat  && long ) {
                    
                        sessionStartPosFound = true;
                        
                        setMapCenter(session.sport[index], lat, long);

                        mapCenterSet = true;

                        
                    }
                });
            }


        // Valid .FIT file have session record, but invalid fit may not....try to fetch from record head instead

        if (!sessionStartPosFound && rawdata.record)
            {
                var lat;

                if (rawdata.record.position_lat  && rawdata.record.position_lat.length > 0)
                    lat = rawdata.record.position_lat[0];

                var long;

                if (rawdata.record.position_long  && rawdata.record.position_long.length > 0)
                    long = rawdata.record.position_long[0];

                var sport = rawdata.lap.sport[0];
                if (sport === undefined)
                    sport = 0; // Default to generic

                if (lat && long) {
                    console.info("No start position was found in session data, got a position at start of record messages.", lat,long);
                    setMapCenter(sport, lat, long);
                    mapCenterSet = true;
                }
            }

        return mapCenterSet;

    };

    UIController.prototype.showSessionsAsOverlay = function (map, rawdata) {
        var self = this;
        var util = FITUtility();

        var session = rawdata.session;

        // Remove previous overlays
        if (this.sessionRectangles !== undefined) {
            this.sessionRectangles.forEach(function (element, index, array) {
                self.sessionRectangles[index].setMap(null);
            });
        }

        if (session === undefined)
            return false;

        if (session.swc_lat === undefined || session.swc_long === undefined || session.nec_lat === undefined || session.nec_long === undefined) {
            console.info("No swc/nec data available in session");
            return false;
        }

    
        var sessionCoords = [];
        self.sessionRectangles = [];
        var fillColors = [];

        session.swc_lat.forEach(function (value, index, array) {

          
            if (session.swc_lat[index] &&
                session.swc_long[index] &&
                session.nec_lat[index] &&
                session.nec_long[index] ) {
                sessionCoords.push([
            new google.maps.LatLng(util.semiCirclesToDegrees(session.swc_lat[index]), util.semiCirclesToDegrees(session.swc_long[index])),
            new google.maps.LatLng(util.semiCirclesToDegrees(session.swc_lat[index]), util.semiCirclesToDegrees(session.nec_long[index])),
            new google.maps.LatLng(util.semiCirclesToDegrees(session.nec_lat[index]), util.semiCirclesToDegrees(session.nec_long[index])),
            new google.maps.LatLng(util.semiCirclesToDegrees(session.nec_lat[index]), util.semiCirclesToDegrees(session.swc_long[index]))]);
            }

            switch (session.sport[index]) {
                case FITSport.running:
                    fillColors.push("#339933");
                    break;
                case FITSport.cycling:
                    fillColors.push("#999");
                    break;
                case FITSport.swimming:
                    fillColors.push("#0066CC");
                    break;
                default:
                    fillColors.push("#339933");
                    break;
            }

            self.sessionRectangles.push( new google.maps.Polygon({
                paths: sessionCoords[index],
                strokeColor: "#000000",
                strokeOpacity: 0.10,
                strokeWeight: 1,
                fillColor: fillColors[index],
                fillOpacity: 0.10
            }));

            self.sessionRectangles[index].setMap(map);

        }
            );

        return true;
    };

    UIController.prototype.initMap = function () {

        // f.ex in case google maps api is not downloaded due to network problems....
        // http://joshua-go.blogspot.no/2010/07/javascript-checking-for-undeclared-and.html

        if (typeof (google) === "undefined")
            return undefined;

        var myCurrentPosition, newMap;

        var mapOptions = {
            zoom: 11,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        newMap = new google.maps.Map(document.getElementById("activityMap"), mapOptions);


        if (navigator.geolocation) {
            // Async call with anonymous callback..
            navigator.geolocation.getCurrentPosition(function (position) {
                myCurrentPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
              var  currentCenter = newMap.getCenter();

                if (currentCenter === undefined)
                    newMap.setCenter(myCurrentPosition);
            });
        }

        return newMap;
    };

    UIController.prototype.showLaps = function (rawData) {


   this.divSessionLap.show();

            
    };

    getIndexOfTimestamp = function (record,timestamp) {

        var findNearestTimestamp = function (timestamp) {
            var indxNr = -1;
            var breaked = false;
            var len = record.timestamp.length;
            for (indxNr = 0; indxNr < len; indxNr++) {
                if (record.timestamp[indxNr] >= timestamp) {
                    breaked = true;
                    break;
                }
            }
            if (breaked)
                return indxNr;
            else
                return indxNr - 1;
        };

        var indexTimestamp;

        indexTimestamp = record.timestamp.indexOf(timestamp);
        if (indexTimestamp === -1) {
            console.warn("Direct lookup for timestamp ", timestamp, " not found, looping through available timestamps on message property record.timestamp to find nearest");
            indexTimestamp = findNearestTimestamp(timestamp);
        }

        return indexTimestamp;

    }

    UIController.prototype.showPolyline = function (map, record, startTimestamp, endTimestamp) {
      
        var self = this;

        // Clear previous polyline
        if (self.activityPolyline) {

            self.activityPolyline.setMap(null);
            self.activityPolyline = null;
        }

        if (record === undefined) {
            console.info("No record msg. to based plot of polyline data for session,lap etc.");
            return false;
        }

        if (record.position_lat === undefined) {
            console.info("No position data (position_lat), cannot render polyline data");
            return false;
        }

        var activityCoordinates = [];
        var util = FITUtility();

        // Build up polyline
        
            var latLength = record.position_lat.length;
            console.info("Total GPS points available (on property position_lat) : ", latLength);

        
            //var sampleInterval = Math.floor(latLength / 30);

            //if (sampleInterval < 1)
            //    sampleInterval = 1;

            var sampleInterval = 2; // Max. sampling rate for 910XT is 1 second 

            console.info("Sample length for polyline is ", sampleInterval);

            //var sample = 0;

            //var sampleLimit = 100;

            //var findNearestTimestamp = function(timestamp) {
            //    var indxNr;
            //    for (indxNr = 0; indxNr < latLength; indxNr++) {
            //        if (record.timestamp[indxNr] >= timestamp)
            //            break;
            //    }
            //    return indxNr;
            //};

            var indexStartTime = getIndexOfTimestamp(record,startTimestamp);

            var indexEndTime = getIndexOfTimestamp(record,endTimestamp);
          

            for (var index = indexStartTime; index <= indexEndTime; index++) {
                if (index === indexStartTime || (index % sampleInterval === 0) || index === indexEndTime)
                    if (record.position_long[index] !== undefined)
                        activityCoordinates.push(new google.maps.LatLng(util.semiCirclesToDegrees(record.position_lat[index]), util.semiCirclesToDegrees(record.position_long[index])));
            }

            console.info("Total length of polyline array with coordinates is : ", activityCoordinates.length.toString());

           // var testarr = activityCoordinates.slice(0, sampleLimit);

        self.activityPolyline = new google.maps.Polyline({
            path: activityCoordinates,
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 2
        });

        self.activityPolyline.setMap(map);

        return true;
      

    };

    UIController.prototype.convertSpeedConverterModel = function (speedMprSEC) {
       
        //ko.mapping.fromJS(speedMprSEC, {}, this);
        var self = this;
        var minPrKM;
        var minPr100M;
        
        self.value = speedMprSEC;

         self.toMINpr100M = ko.computed(function () {
           
            if (speedMprSEC > 0)
                minPr100M = 1 / (speedMprSEC * 60 / 100); // min/100m
            else
                minPr100M = 0;

            var minutes = Math.floor(minPr100M);
            var seconds = ((minPr100M - minutes) * 60).toFixed(); // implicit rounding

            var result = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            return result;
        }, self);

        self.toMINprKM = ko.computed(function () {
           
            if (speedMprSEC > 0)
                minPrKM = 1 / (speedMprSEC * 60 / 1000); // min/km
            else
                minPrKM = 0;

            var minutes = Math.floor(minPrKM);
            var seconds = ((minPrKM - minutes) * 60).toFixed(); // implicit rounding

            var result = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            return result;
        }, self);

        self.toKMprH = ko.computed(function () {
            var kmPrH = (speedMprSEC * 3.6).toFixed(1);
            return kmPrH;
        }, self);
        
        
    };

    UIController.prototype.convertSecsToHHMMSSModel = function (totalSec) {
        // Callback on "create" from knockout
        //ko.mapping.fromJS(totalSec, {}, this); //Maybe not needed on scalar object

        this.value = totalSec;
        this.toHHMMSS = ko.computed(function () {
            // http://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript

            var hours = parseInt(totalSec / 3600, 10) % 24;
            var minutes = parseInt(totalSec / 60, 10) % 60;
            var seconds = parseInt(totalSec % 60, 10);

            var hourResult;
            if (hours != 0)
                hourResult = (hours < 10 ? "0" + hours : hours) + ":";
            else
                hourResult = "";

            var result = hourResult + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            return result;
        }, this);
    };

    UIController.prototype.intepretMessageCounters  = function (counter) {
        if (counter.fileIdCounter != 1)
            console.error("File id msg. should be 1, but is ", counter.fileIdCounter);
        if (counter.fileIdCounter != 1)
            console.error("File creator msg. should be 1, but is ", counter.fileCreatorCounter);
        if (counter.sessionCounter === 0)
            console.error("Session msg. should be at least 1, but is ",counter.sessionCounter);
        if (counter.lapCounter === 0)
            console.error("Lap msg. should be at least 1, but is ",counter.lapCounter);
        if (counter.activityCounter !== 1)
            console.error("Activity msg. should be 1, but is ", counter.activityCounter);
        if (counter.deviceInfoCounter === 0)
            console.error("Expected more than 0 device_info msg. ", counter.deviceInfoCounter);
        if (counter.recordCounter === 0)
            console.error("No record msg. ", counter.lapCounter);

    };

    UIController.prototype.resetViewModel = function (viewModel) {
        // Set arrays to []

        // Take timestamp first to collapse DOM outline to make other collapses "hidden"

        if (viewModel.timestamp)
            viewModel.timestamp([]);

        var mappingProperty = "__ko_mapping__";
        for (var observableArray in viewModel) {

            if (observableArray !== "timestamp" && observableArray !== mappingProperty && viewModel[observableArray] ) {
                // console.log("RemoveAll() on ", observableArray);
                viewModel[observableArray]([]);
            }
        }

       

    };

    UIController.prototype.onFITManagerMsg = function (e) {

       
        // Had to introduce this due to some issues with databinding, if new properties was introduced in rawdata,
        // databinding would not kick in even when data is mapped ok. Probably is due to some issues with <!-- ko: if -->
        // virtual elements and something with "changed" value notification. Introducing empty observables on unused properties gives a performance penalty.
        emptyViewModel = function (msg) {
            var ViewModel = {};
            
            for (var fieldDefNr in msg) 
                ViewModel[msg[fieldDefNr].property] = ko.observableArray([]);
        
            return ViewModel;
            
        };

        var fitActivity = FIT.ActivityFile();

        var eventdata = e.data;

        switch (eventdata.response) {

            case 'rawData':
                //var rawData = JSON.parse(data.rawdata);
               
                var rawData = eventdata.rawdata;

                FITUI.intepretMessageCounters(rawData.counter);

                // Value converters that are run on "create"-event/callback in knockout
                var mappingOptions = {
                    'total_elapsed_time': {
                        create: function (options) {
                            return new FITUI.convertSecsToHHMMSSModel(options.data);
                        }
                    },
                    'total_timer_time': {
                        create: function (options) {
                            return new FITUI.convertSecsToHHMMSSModel(options.data);
                        }
                    },
                    'avg_speed': {
                        create: function (options) {
                            return new FITUI.convertSpeedConverterModel(options.data);
                        }
                    },
                    'max_speed': {
                        create: function (options) {
                            return new FITUI.convertSpeedConverterModel(options.data);
                        }
                    }
                };
                

                var liId = '#liSessions';
                var jquerySessionElement = $(liId);
                var sessionElement = jquerySessionElement[0];
                console.log(liId+" for data binding", sessionElement);
               
                if (FITUI.sessionViewModel === undefined && rawData.session) {

                    // http://stackoverflow.com/questions/10048485/how-to-clear-remove-observable-bindings-in-knockout-js

                       // Skip mapping and apply bindings only on available data

                    FITUI.sessionViewModel = emptyViewModel(fitActivity.session());

                    ko.mapping.fromJS(rawData.session, mappingOptions,FITUI.sessionViewModel);

                    FITUI.sessionViewModel.tempoOrSpeed = ko.observable(undefined);

                    FITUI.sessionViewModel.showDetails = function (data,event) {
                        // In callback from knockoutjs, this = first argument to showDetails.bind(...), then $data and event is pushed
                        var index = this;
                        var polylinePlotted = FITUI.showPolyline(FITUI.map, rawData.record, rawData.session.start_time[index], rawData.session.timestamp[index]);

                        // Rendering charts can take quite a while....,

                       // window.setTimeout(function () {
                            FITUI.showChartsDatetime(rawData, rawData.session.start_time[index], rawData.session.timestamp[index]);
                        //},
                        //    500);

                    }

                       // jquerySessionElement.show();
                        ko.applyBindings(FITUI.sessionViewModel, sessionElement); // Initialize model with DOM 
                    
                }
                else {

                    // Discussion: https://groups.google.com/forum/?fromgroups=#!topic/knockoutjs/LWsxAJ3m97s

                    FITUI.resetViewModel(FITUI.sessionViewModel);

                    ko.mapping.fromJS(rawData.session, mappingOptions, FITUI.sessionViewModel); // Just update model with new data
                }

                   
                var jqueryLapNode = $('#divLaps');
                var lapNode = jqueryLapNode[0];
                console.log("#divLaps for data binding", lapNode);

                if (FITUI.lapViewModel === undefined && rawData.lap) {
                    FITUI.lapViewModel = emptyViewModel(fitActivity.lap());
                        FITUI.lapViewModel = ko.mapping.fromJS(rawData.lap, mappingOptions);
                       // jqueryLapNode.show();
                        ko.applyBindings(FITUI.lapViewModel, lapNode);
                       
                }
                else {
                    FITUI.resetViewModel(FITUI.lapViewModel);
                    ko.mapping.fromJS(rawData.lap, mappingOptions, FITUI.lapViewModel);
                }

                // Initialize map
                if (FITUI.map === undefined)
                  FITUI.map = FITUI.initMap();

                switch (rawData.file_id.type[0]) {
                    case 4: // Activity file

                        FITUI.showLaps(rawData);

                        if (FITUI.map) {
                            var sessionMarkerSet = FITUI.showSessionMarkers(FITUI.map, rawData);

                            var sessionAsOverlaySet = FITUI.showSessionsAsOverlay(FITUI.map, rawData);

                            var polylinePlotted = FITUI.showPolyline(FITUI.map, rawData.record, rawData.session.start_time[0], rawData.session.timestamp[0]);
                        }
                        //if (sessionMarkerSet || sessionAsOverlaySet || polylinePlotted)
                        //   $('#activityMap').show();

                         FITUI.showChartsDatetime(rawData, rawData.session.start_time[0], rawData.session.timestamp[0]);
                         
                        //FITUI.showChartHrv(rawData);

                        FITUI.showDataRecordsOnMap(eventdata.datamessages);
                        break;

                    default:
                        console.warn("Unsupported fit file type, expected 4 (activity file), but got ", rawData.file_id.type[0]);
                        break;

                }

                break;

            case 'header':
                var headerInfo = eventdata.header;
                if (headerInfo.estimatedFitFileSize != headerInfo.fitFile.size)
                    console.warn("Header reports FIT file size " + headerInfo.estimatedFitFileSize.toString() + " bytes, but file system reports: " + headerInfo.fitFile.size.toString() + " bytes.");
                break;

            case 'error':
                var errMsg = eventdata.data;

                if (eventdata.event != undefined) {
                    errMsg += " Event; ";
                    for (var prop in eventdata.event) {
                        if (typeof prop === "string")
                            errMsg += "property " + prop + " : " + eventdata.event.prop;
                    }
                }
                console.error(errMsg);
                break;

            case 'info':
                console.info(eventdata.data);
                break;

            case 'importProgress':
               
            FITUI.progressFITimportViewModel.progressFITimport(eventdata.data);

                //FITUI.progressFITImport.setAttribute("value", eventdata.data);
            break;

            case 'importFinished':
                $("#progressFITimport").hide();
                FITUI.progressFITimportViewModel.progressFITimport(0);

                break;


            default:
                console.error("Received unrecognized message from worker " + eventdata.response);
                break;
        }



    };

    UIController.prototype.onFITManagerError = function (e) {
        console.error("Error in worker, status " + e.toString());
    };

    UIController.prototype.onFitFileSelected = function (e) {
        // console.log(e);
        e.preventDefault();

        //$('#activityMap').hide();

        FITUI.selectedFiles = e.target.files;

        var files = FITUI.selectedFiles;

        // Setup mutiple/batch workers
        console.log("Setup of " + files.length + " workers.");
        for (var fileNr = 0; fileNr < files.length; fileNr++) {
            //FITUI["fitFileManager" + fileNr.toString()] = new Worker("Scripts/fitFileManager.js")
            //FITUI["fitFileManager" + fileNr.toString()].addEventListener('message', FITUI.onFITManagerMsg, false);
            //FITUI["fitFileManager" + fileNr.toString()].addEventListener('error', FITUI.onFITManagerError, false);

        }

        // Make sure we terminate previous worker
        if (FITUI.fitFileManager !== undefined) {
            FITUI.fitFileManager.removeEventListener('error', FITUI.onFITManagerError, false);
            FITUI.fitFileManager.removeEventListener('message', FITUI.onFITManagerMsg, false);
            FITUI.fitFileManager.terminate();
        }

        FITUI.fitFileManager = new Worker("Scripts/FITImport.js");
        FITUI.fitFileManager.addEventListener('message', FITUI.onFITManagerMsg, false);
        FITUI.fitFileManager.addEventListener('error', FITUI.onFITManagerError, false);


        // Need to adjust timestamps in the underlying data from Garmin time/System time

        // Start our worker now
        //var msg = { request: 'loadFitFile', "fitfile": files[0], "timeCalibration" : timeCalibration, "globalmessage" : "record", "fields" : "heart_rate altitude cadence speed", skipTimestamps : false };

        //var query = [];

        //query.push(

        //   // { message: "hrv", fields: "time" },
        //   { message: "file_id", fields: "type manufacturer product serial_number time_created number" },
        //   { message: "file_creator", fields: "software_version hardware_version" },
        //   { message: "record", fields: "timestamp position_lat position_long heart_rate altitude speed" },
        //   { message: "session", fields: "timestamp start_time start_position_lat start_position_long total_training_effect num_laps" },
        //   { message: "activity", fields: "timestamp total_timer_time num_sessions type event event_type local_timestamp event_group" },
        //  { message: "hrv", fields: "time" }
        //   );

        // deleteDb();

        var msg = {
            request: 'importFitFile', "fitfile": files[0]
            //, "query": query
        };


        if (FITUI.progressFITimportViewModel !== undefined)
            FITUI.progressFITimportViewModel = null;

        FITUI.progressFITimportViewModel = new progressFITimportViewModel();
        ko.applyBindings(FITUI.progressFITimportViewModel, document.getElementById("progressFITimport"));
        $("#progressFITimport").show();

        FITUI.fitFileManager.postMessage(msg);



    };

    UIController.prototype.showDataRecordsOnMap = function (dataRecords) {

var self = this;
        var FIT_MSG_FILEID = 0;
        var FIT_MSG_SESSION = 18;
        var FIT_MSG_LAP = 19;
        var FIT_MSG_RECORD = 20;
        var FIT_MSG_EVENT = 21;
        var FIT_MSG_ACTIVITY = 34;
        var FIT_MSG_FILE_CREATOR = 49;
        var FIT_MSG_HRV = 78;
        var FIT_MSG_DEVICE_INFO = 23;
        var FIT_MSG_LENGTH = 101;

        // Clear div
        while (this.divMsgMap.firstChild) {
            this.divMsgMap.removeChild(this.divMsgMap.firstChild);
        }

        dataRecords.forEach(function (element, index, array) { // forEach takes a callback

            var styleClass = "";
            switch (element) {
                case FIT_MSG_FILEID: styleClass = 'FITfile_id'; break;
                case FIT_MSG_SESSION: styleClass = 'FITsession'; break;
                case FIT_MSG_LAP: styleClass = 'FITlap'; break;
                case FIT_MSG_RECORD: styleClass = 'FITrecord'; break;
                case FIT_MSG_DEVICE_INFO: styleClass = 'FITdevice_info'; break;
                case FIT_MSG_ACTIVITY: styleClass = 'FITactivity'; break;
                case FIT_MSG_HRV: styleClass = 'FIThrv'; break;
                case FIT_MSG_EVENT: styleClass = 'FITevent'; break;
                case FIT_MSG_FILE_CREATOR: styleClass = 'FITfile_creator'; break;
                case FIT_MSG_LENGTH: styleClass = 'FITlength'; break;
                default: styleClass = 'FITunknown'; break;
            }

            self.divMsgMap.insertAdjacentHTML("beforeend", '<div class=' + styleClass + '></div>');
        });
    };

    function progressFITimportViewModel() {
        var self = this;

        self.progressFITimport = ko.observable(0);
    }

    function deleteDb() {
        // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory#deleteDatabase
        // Problem : can only delete indexeddb one time in the same tab
        //self.postMessage({ response: "info", data: "deleteDb()" });

        var req;

        try {
            req = indexedDB.deleteDatabase("fit-import");
        } catch (e) {
            console.error(e.message);
        }
        //req.onblocked = function (evt) {
        //    self.postMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
        //}


        req.onsuccess = function (evt) {
            console.info("Delete "+evt.currentTarget.readyState);
            
        };

        req.onerror = function (evt) {
            console.error("Error deleting database");
        };

    }

    function saveHRZones(e) {

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
            console.info("Local storage of " + key + " not found, using default HR Zones");
            myZones = [{ name: 'Zone 1', min: 106, max: 140 },   // No storage found use default
                     { name: 'Zone 2', min: 141, max: 150 },
                     { name: 'Zone 3', min: 151, max: 159 },
                     { name: 'Zone 4', min: 160, max: 170 },
                     { name: 'Zone 5', min: 171, max: 256 }];
        }

        return myZones;
    }

})

// We have created a socalled Immediately-Invoked Function Expression (IIFE)

(); // Run it